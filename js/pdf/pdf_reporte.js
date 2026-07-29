// pdf_reporte.js - Generador Unificado de Informes para ESPACIA
import { prepararDocumento, dibujarEncabezado, dibujarPiePagina } from './pdf_core.js';
import { APP_CONFIG } from '../config.js';
import { getCanceladoPor } from '../utils.js';

/**
 * Función principal que decide qué tipo de reporte generar basándose en los filtros.
 */
export async function generarPDFInforme(filtros) {
    try {
        const { reservas = [], totales = {}, fechaInicio = '', fechaFin = '', estado = '', usuario = '', espacio = '' } = filtros;
        
        // 1. Preparar documento base (A4)
        const { doc, config } = await prepararDocumento('a4');
        
        // 2. Determinar subtítulo y lógica de nombre de archivo
        let subtituloHeader = "Informe de Movimientos";
        let nombreArchivoPrefijo = "Informe_General";
        let resumenTitle = 'RESUMEN DE GESTIÓN';

        if (usuario) {
            const nombreUser = document.getElementById('combo-usuario-informe')?.options[document.getElementById('combo-usuario-informe').selectedIndex]?.text || usuario;
            // Mantener el encabezado general inalterado y mover el nombre al título del resumen
            nombreArchivoPrefijo = `Informe_Particular_${nombreUser.replace(/\s+/g, '_')}`;
            resumenTitle = `RESUMEN DE GESTIÓN - ${nombreUser}`;
        } else if (estado) {
            subtituloHeader = `Informe de Reservas: ${estado}`;
            nombreArchivoPrefijo = `Reporte_${estado}`;
        }

        // 3. Dibujar Encabezado
        dibujarEncabezado(doc, config, subtituloHeader);

        // 4. Información de Período
        const rangoFechas = `${fechaInicio.split('-').reverse().join('/')} al ${fechaFin.split('-').reverse().join('/')}`;
        doc.setFontSize(10).setTextColor(40).setFont(undefined, 'bold');
        doc.text(`Período: ${rangoFechas}`, 14, 30);

        // --- SECCIÓN 1: RESUMEN DE GESTIÓN ---
        const intervalos = APP_CONFIG.horarios?.intervalos || [60, 90];
        const cabeceraDesglose = `Desglose (${intervalos.map(m => m + 'm').join('/')})`;
        
        doc.setFontSize(13).setTextColor(40).text(resumenTitle, 14, 42);

        let filasResumen = [];
        if (estado) {
            // Si hay filtro de estado, mapear a la clave correcta en `totales`
            const e = estado.toLowerCase();
            let clave = 'reservadas';
            if (e === 'cancelada') clave = 'canceladas';
            else if (e === 'consumida' || e === 'usada') clave = 'consumidas';
            else if (e === 'pendiente') clave = 'pendientes';
            filasResumen.push(generarFilaResumen(estado, totales[clave], intervalos));
        } else {
            // Si es general o por usuario, mostramos todo el desglose incluyendo pendientes
            filasResumen = [
                generarFilaResumen('Reservas Totales', totales.reservadas, intervalos),
                generarFilaResumen('Pendientes', totales.pendientes, intervalos),
                generarFilaResumen('Consumidas', totales.consumidas, intervalos),
                generarFilaResumen('Canceladas', totales.canceladas, intervalos)
            ];
        }

        doc.autoTable({
            startY: 45,
            head: [['Estado', 'Tiempo Total', 'Cantidad', cabeceraDesglose]],
            body: filasResumen,
            theme: 'grid',
            headStyles: { fillColor: config.color, fontSize: 11, halign: 'center' },
            styles: { fontSize: 11, cellPadding: 4, valign: 'middle' },
            columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } }
        });

        // --- SECCIÓN 2: DETALLE DE MOVIMIENTOS ---
        doc.setFontSize(11).setTextColor(40).text('DETALLE DE MOVIMIENTOS', 14, doc.lastAutoTable.finalY + 12);
        
        const etiquetaEspacio = APP_CONFIG.espacios?.etiquetaGeneral || 'Espacio';
        const headersDetalle = ['Fecha', 'Inic.', 'Durac.', 'Usuario', etiquetaEspacio, 'Estado', 'Cancelado por'];

        // Resolver cancelador con fallback: usar getCanceladoPor si existe, sino r.canceladoPor o 'Administración'
        function resolveCancelador(r) {
            try {
                if (typeof getCanceladoPor === 'function') {
                    const val = getCanceladoPor(r);
                    if (val) return val;
                }
            } catch (e) {
                // ignore and fallback
            }
            return r.canceladoPor || 'Administración';
        }

        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15,
            head: [headersDetalle],
            body: reservas.map(r => {
                const isCancelada = (r.estado && r.estado.toUpperCase() === 'CANCELADA');
                const cancelador = isCancelada ? resolveCancelador(r) : '';

                return [
                    r.fecha,
                    r.inicio,
                    r.duracion,
                    r.usuario,
                    r.espacio,
                    r.estado.toUpperCase(),
                    cancelador
                ];
            }),
            theme: 'striped',
            headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
            styles: { fontSize: 8.5 },
            columnStyles: {
                5: { fontStyle: 'bold' },
                6: { textColor: [180, 0, 0], fontStyle: 'bold', halign: 'center' }
            }
        });

        // 5. Pie de página y Guardar
        dibujarPiePagina(doc, config);
        
        const nombreCons = espacio ? (document.getElementById('combo-consultorio')?.options[document.getElementById('combo-consultorio').selectedIndex]?.text || espacio) : "Todos";
        const nombreFinal = `${nombreArchivoPrefijo}_${nombreCons}_${fechaInicio}_a_${fechaFin}.pdf`.replace(/\s+/g, '_');
        
        doc.save(nombreFinal);

    } catch (e) {
        console.error("Error al generar el PDF unificado:", e);
    }
}

// Helpers internos
function generarFilaResumen(label, stat, intervalos) {
    return [
        label, 
        stat?.horas || '00:00', 
        stat?.count || 0, 
        intervalos.map(m => stat?.desglose?.[m] || 0).join(' / ')
    ];
}