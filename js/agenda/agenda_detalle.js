// js/agenda/agenda_detalle.js
// Modal de detalle de una reserva existente: muestra datos, descarga PDF
// y delega la cancelación a agenda_cancelar.js

import { APP_CONFIG } from '../config.js';
import { mostrarToast, mostrarModalConfirmacion, getRealizadoPor } from '../utils.js';
import { cancelarReserva, extraerDatosDescription } from './agenda_cancelar.js';

// Formatea el description de Google Calendar para mostrarlo en HTML
function formatearDescription(description) {
    if (!description) return '';

    // Reemplazar creador por Administracion cuando sea un admin/gestor reservando para otro titular
    let descriptionFinal = description;
    const reservaParaMatch = descriptionFinal.match(/Reserva para:\s*([^\n<]+)/i);
    const reservaParaNombre = reservaParaMatch ? reservaParaMatch[1].trim() : '';
    const realizadoPor = getRealizadoPor({ usuario: reservaParaNombre, description: descriptionFinal });
    if (realizadoPor) {
        descriptionFinal = descriptionFinal.replace(/Reserva realizada por:\s*[^\n]*/i, `Reserva realizada por: ${realizadoPor}`);
    }

    if (!descriptionFinal.includes('\n')) {
        return descriptionFinal
            .replace(/Email:/g,                '<br><strong>Email:</strong>')
            .replace(/Consultorio:/g,           '<br><strong>Consultorio:</strong>')
            .replace(/Fecha:/g,                 '<br><strong>Fecha:</strong>')
            .replace(/Hora:/g,                  '<br><strong>Hora:</strong>')
            .replace(/Intervalo:/g,             '<br><strong>Intervalo:</strong>')
            .replace(/Reserva realizada por:/g, '<br><br><strong>Reserva realizada por:</strong>')
            .replace(/Reserva Cancelada por:/g, '<br><br><strong style="color:red;">Reserva Cancelada por:</strong>');
    }
    return descriptionFinal.replace(/\n/g, '<br>');
}

// Obtiene el nombre y rol del usuario que está operando en este momento
function obtenerUsuarioActual() {
    try {
        const userActual = JSON.parse(localStorage.getItem('usuarioActual'))
                        || JSON.parse(sessionStorage.getItem('usuarioActual'));
        if (!userActual) return { nombreUsuario: '', esAdminCancelador: false };

        const esAdminCancelador = (userActual.rol === 'admin' || userActual.rol === 'gestor');
        // nombreUsuario = quien ejecuta la cancelación (el usuario logueado, sea admin o profesional)
        // NUNCA el valor del combo — ese es el profesional de la reserva, no quien cancela
        const nombreUsuario = userActual.nombre || userActual.email.split('@')[0].replace(/\./g, ' ');
        return { nombreUsuario, esAdminCancelador };
    } catch {
        return { nombreUsuario: '', esAdminCancelador: false };
    }
}

window.mostrarDetalleReserva = function(id, summary, description, created, recargarGrilla) {
    const formattedDescription = formatearDescription(description);

    const contenido = `
        <div style="margin-bottom:20px;color:var(--text-main,#333);font-size:1rem;line-height:1.5;text-align:left;">
            <strong style="font-size:1.1rem;color:var(--primary,#2c3e50);">${summary}</strong><br><br>
            ${formattedDescription}
        </div>
        <button id="btn-descargar-pdf-modal" style="width:100%;padding:10px;background:#27ae60;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-bottom:15px;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Descargar PDF
        </button>
    `;

    mostrarModalConfirmacion(
        "Detalles de la Reserva",
        contenido,
        "Cancelar Reserva",
        async (btnConfirmar, btnCancelar, modal) => {
            btnConfirmar.disabled = true;
            btnConfirmar.innerText = 'Cancelando...';
            const { nombreUsuario, esAdminCancelador } = obtenerUsuarioActual();
            await cancelarReserva({
                id, summary, description,
                nombreUsuario,
                esAdmin: esAdminCancelador,
                created,
                modal, btnConfirmar,
                recargarGrilla
            });
        },
        "Aceptar",
        "#e74c3c"
    );

    // Descargar PDF de comprobante de reserva
    document.getElementById('btn-descargar-pdf-modal').onclick = async () => {
        try {
            const datos = extraerDatosDescription(summary, description);
            const { generarTicketReserva } = await import('../pdf/pdf_ticket_reserva.js');
            await generarTicketReserva({
                usuario:           datos.usuario,
                email:             datos.email,
                fecha:             datos.fecha,
                inicio:            datos.horaInicio,
                fin:               datos.horaFin,
                intervalo:         datos.intervalo,
                espacio:           datos.espacio,
                creadoPor:         datos.creadoPor,
                realizadaPorAdmin: !!datos.creadoPor,
                fechaCreacion:     created || null
            });
        } catch (e) {
            console.error("Error al generar PDF:", e);
            mostrarToast("Error al generar el PDF", "error");
        }
    };
};