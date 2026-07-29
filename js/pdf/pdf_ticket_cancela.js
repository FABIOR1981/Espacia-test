export async function generarTicketCancelacion(reserva) {
    // Fix: imports fuera del try/catch para que errores de carga no queden silenciados
    const { prepararDocumento, dibujarEncabezado, dibujarPiePagina } = await import('./pdf_core.js');
    const { APP_CONFIG } = await import('../config.js');
    try {
        let profesional = reserva.usuario;
        let fecha       = reserva.fecha;
        let inicio      = reserva.inicio;
        let fin         = reserva.fin;
        let espacio     = reserva.espacio;

        // Si vienen summary/description, extraer datos desde ahí
        if (reserva.summary || reserva.description) {
            if (reserva.summary) {
                const match = reserva.summary.match(/Reserva: (.+)/);
                if (match) profesional = match[1];
            }
            if (reserva.description) {
                const fechaMatch = reserva.description.match(/Fecha:\s*([\d\/-]+)/);
                if (fechaMatch && (!reserva.fecha || reserva.fecha === '' || reserva.fecha === 'undefined')) {
                    fecha = fechaMatch[1];
                }

                const horaRango = reserva.description.match(/Hora:\s*([\d:]+)\s*a\s*([\d:]+)\s*hs/);
                if (horaRango) {
                    inicio = horaRango[1];
                    fin    = horaRango[2];
                } else {
                    const horaSimple = reserva.description.match(/Hora:\s*([\d:]+)\s*hs/);
                    const intervalo  = reserva.description.match(/Intervalo:\s*(\d+)/);
                    if (horaSimple) {
                        inicio = horaSimple[1];
                        if (intervalo) {
                            const [h, m] = inicio.split(':').map(Number);
                            const fObj = new Date(2000, 0, 1, h, m);
                            fObj.setMinutes(fObj.getMinutes() + parseInt(intervalo[1]));
                            fin = `${fObj.getHours().toString().padStart(2, '0')}:${fObj.getMinutes().toString().padStart(2, '0')}`;
                        }
                    }
                }

                const espacioMatch = reserva.description.match(/Consultorio:\s*([\w\d]+)/);
                if (espacioMatch) {
                    const prefijo  = APP_CONFIG.espacios?.prefijoGeneral || 'C';
                    const etiqueta = APP_CONFIG.espacios?.etiquetaGeneral || 'Lugar';
                    if (espacioMatch[1].length > 1 && espacioMatch[1][0].toUpperCase() === prefijo.toUpperCase()) {
                        espacio = etiqueta + ' ' + espacioMatch[1].slice(1);
                    } else {
                        espacio = etiqueta + ' ' + espacioMatch[1];
                    }
                }
            }
        }

        // Normalizar espacio siempre — puede llegar como "4", "C4" o "Consultorio 4"
        const prefijo2  = APP_CONFIG.espacios?.prefijoGeneral || 'C';
        const etiqueta2 = APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio';
        espacio = String(espacio || '');
        if (espacio && !espacio.toLowerCase().startsWith(etiqueta2.toLowerCase())) {
            // Quitar prefijo si viene como "C4" → "4"
            if (espacio[0].toUpperCase() === prefijo2.toUpperCase()) {
                espacio = etiqueta2 + ' ' + espacio.slice(1);
            } else if (!isNaN(espacio)) {
                // Es solo número "4" → "Consultorio 4"
                espacio = etiqueta2 + ' ' + espacio;
            }
        }

        const { doc, config } = await prepararDocumento('a5');
        dibujarEncabezado(doc, config, "Comprobante de Cancelación");

        const xMargin = 14;
        doc.setFontSize(11).setTextColor(40).setFont(undefined, 'bold').text("DETALLE DE CANCELACIÓN", xMargin, 35);

        // Mostrar claramente creador y cancelador:
        // - reserva.creadoPor = quien originalmente hizo la reserva (puede ser gestor/admin o el mismo usuario)
        // - reserva.canceladoPor = quien ejecutó la cancelación
        // Usar utilidades centralizadas para consistencia
        const { getRealizadoPor, getCanceladoPor } = await import('../utils.js');
        const displayCreadoPor = getRealizadoPor(reserva) || (reserva.usuario || '');
        const displayCanceladoPor = getCanceladoPor(reserva);

        // Formatear fecha de creación desde ISO a formato local
        const fechaCreacionDisplay = reserva.fechaCreacion
            ? new Date(reserva.fechaCreacion).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'short' })
            : '';

        // Importar función utilitaria
        const { formatFechaCorta, parseFecha } = await import('../utils.js');
        const fechaFinal = parseFecha(reserva.fecha) || parseFecha(reserva.description?.match(/Fecha:\s*([\d\/\-]+)/)?.[1]);
        const lineas = [
            ["Profesional:",           profesional],
            ["Fecha:",                 formatFechaCorta(fechaFinal)],
            ["Horario:",               inicio && fin ? `${inicio} a ${fin} hs` : ""],
            ["Lugar:",                 espacio],
            ["Reserva realizada por:", displayCreadoPor],
            ...(fechaCreacionDisplay ? [["Fecha de reserva:", fechaCreacionDisplay]] : []),
            ["Cancelada por:",         displayCanceladoPor],
            ["Fecha de cancelación:",  reserva.fechaCancelacion || new Date().toLocaleString('es-UY')]
        ];

        doc.setFontSize(10).setTextColor(40);
        let y = 45;
        lineas.forEach((linea, i) => {
            doc.setFont(undefined, 'normal').text(linea[0], xMargin, y);
            doc.setFont(undefined, 'bold').text(String(linea[1] || ''), 60, y);
            y += (i === 3 ? 16 : 12); // Más espacio después de Consultorio
        });

        dibujarPiePagina(doc, config);

        const nombreDoc = (profesional || "Cancelacion").replace(/\s+/g, '_');
        const fechaDoc  = (fecha || "sin_fecha").replace(/\//g, '-');
        doc.save(`Ticket_Cancelacion_${nombreDoc}_${fechaDoc}.pdf`);

    } catch (e) {
        console.error("Error en Ticket Cancelación:", e);
    }
}