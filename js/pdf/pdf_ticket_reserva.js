import { prepararDocumento, dibujarEncabezado, dibujarPiePagina } from './pdf_core.js';
import { APP_CONFIG } from '../config.js';
import { parseFecha, formatFechaCorta, getRealizadoPor, getCanceladoPor } from '../utils.js';

export async function generarTicketReserva(reserva) {
    try {
        const { doc, config } = await prepararDocumento('a5');
        dibujarEncabezado(doc, config, "Comprobante de Reserva");
        const xMargin = 14;
        doc.setFontSize(11).setTextColor(40).setFont(undefined, 'bold').text("DETALLES DEL TURNO", xMargin, 35);
        // Mostrar 'Lugar' usando ESPACIOS_ETIQUETA si el prefijo coincide
        let lugar = String(reserva.espacio || '');
        const prefijo = APP_CONFIG.espacios?.prefijoGeneral || 'C';
        const etiqueta = APP_CONFIG.espacios?.etiquetaGeneral || 'Lugar';
        if (lugar.length > 1 && lugar[0].toUpperCase() === prefijo.toUpperCase()) {
            lugar = etiqueta + ' ' + lugar.slice(1);
        } else if (lugar && !isNaN(lugar)) {
            // Si es solo un número (ej: "1"), agregar la etiqueta directamente
            lugar = etiqueta + ' ' + lugar;
        }
       const displayCreadoPor = getRealizadoPor(reserva) || (reserva.usuario || '');

       const fechaRes = parseFecha(reserva.fecha) || parseFecha(reserva.description?.match(/Fecha:\s*([\d\/\-]+)/)?.[1]);
       const fechaMostrar = fechaRes ? formatFechaCorta(fechaRes) : '';
       const displayCanceladoPor =  '';

       const lineas = [
           ["Profesional:", reserva.usuario],
           ["Fecha:", fechaMostrar],
           ["Horario:", `${reserva.inicio} a ${reserva.fin} hs`],
           ["Lugar:", lugar],
           ["Reserva realizada por:", displayCreadoPor],
           ["Fecha de reserva:", reserva.fechaCreacion
               ? new Date(reserva.fechaCreacion).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })
               : ''],
           ["Cancelada por:", displayCanceladoPor],
           ["Fecha de cancelación:", reserva.fechaCancelacion || '']
       ];
    doc.setFontSize(10).setTextColor(40);
    let y = 45;
    lineas.forEach((linea, i) => {
        doc.setFont(undefined, 'normal').text(linea[0], xMargin, y);
        doc.setFont(undefined, 'bold').text(String(linea[1] || ''), 60, y);
        y += (i === 3 ? 16 : 12); // Más espacio después de Lugar
    });
        dibujarPiePagina(doc, config);
        const nombreDoc = (reserva.usuario || "Reserva").replace(/\s+/g, '_');
        doc.save(`Ticket_${nombreDoc}_${reserva.fecha}.pdf`);
    } catch (e) { console.error("Error en Ticket:", e); }
}