import { APP_CONFIG } from '../config.js';

export async function prepararDocumento(formato = 'a4') {
    if (!window.jspdf) {
        try {
            await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        } catch (e) {
            throw new Error('No se pudo cargar jsPDF. Verificá tu conexión a internet.');
        }
    }
    // Carga autotable solo si es un informe A4
    if (formato === 'a4' && !window.jspdf.jsPDF.API.autoTable) {
        try {
            await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
        } catch (e) {
            throw new Error('No se pudo cargar jspdf-autotable. Verificá tu conexión a internet.');
        }
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: formato });
    
    const rawTel = APP_CONFIG.EMPRESA_TELEFONO || '';
    const config = {
        nombre: APP_CONFIG.EMPRESA_NOMBRE || '',
        logo: APP_CONFIG.EMPRESA_LOGO || 'imagenes/logo_default.png',
        color: [211, 84, 0], // Naranja ESPACIA
        width: doc.internal.pageSize.getWidth(),
        height: doc.internal.pageSize.getHeight(),
        telefono: rawTel.replace(/\D/g, '').length === 9 
            ? `${rawTel.slice(0, 3)} ${rawTel.slice(3, 5)} ${rawTel.slice(5)}`
            : rawTel
    };

    return { doc, config };
}

export function dibujarEncabezado(doc, config, subtitulo) {
    const xMargin = 14;
    // Marca
    doc.setFontSize(16).setTextColor(config.color[0], config.color[1], config.color[2]).text("ESPACIA", xMargin, 15);
    doc.setFontSize(9).setTextColor(100).text(subtitulo, xMargin, 20);

    // Logo
    try {
        doc.addImage(config.logo, 'PNG', config.width - 35, 8, 25, 12);
    } catch (e) { console.warn("Logo no disponible"); }

    // Línea de marca
    doc.setDrawColor(config.color[0], config.color[1], config.color[2]).setLineWidth(0.5).line(xMargin, 25, config.width - xMargin, 25);
}

export function dibujarPiePagina(doc, config) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8).setTextColor(150).setFont(undefined, 'italic');
        doc.text(`Gracias por elegir ${config.nombre}`, config.width / 2, config.height - 10, { align: 'center' });
    }
}