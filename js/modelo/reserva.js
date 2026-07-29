// Clase Reserva para agenda_v2.js
import { getAuthHeaders } from '../utils.js';
import { APP_CONFIG } from '../config.js';

export class Reserva {
    constructor(usuario = null, fecha = null, h_inicio = null, lugar = null, creadoPor = null, estado = null, email = null, id = null, intervalo = null, colorId = null, prefijoGcal = null, etiquetaGeneral = null){
        this.usuario = usuario;
        this.fecha = fecha;
        this.h_inicio = h_inicio; // string HH:MM
        this.intervalo = intervalo;
        this.h_fin = this.calcularHoraFin(this.h_inicio, this.intervalo);
        this.lugar = lugar;
        this.creadoPor = creadoPor;
        this.canceladoPor = null;
        this.fechaCreacion = null; // ISO string desde Google Calendar (ev.created)
        this.estado = estado;
        this.email = email;
        this.id = id;
        this.colorId = colorId;
        this.prefijoGcal = prefijoGcal !== null ? prefijoGcal : (APP_CONFIG.espacios?.prefijoGeneral || 'C');
        this.etiquetaGeneral = etiquetaGeneral !== null ? etiquetaGeneral : (APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio');
        // Variables para backend
        this.hora = null;
        this.minutos = null;
        if (this.h_inicio) {
            const [h, m] = this.h_inicio.split(':').map(Number);
            this.hora = h;
            this.minutos = m;
        }
    }

    calcularHoraFin(h_inicio, intervalo) {
        if (!h_inicio || !intervalo) return '';
        const [h, m] = h_inicio.split(':').map(Number);
        const fObj = new Date(2000, 0, 1, h, m);
        fObj.setMinutes(fObj.getMinutes() + parseInt(intervalo));
        return `${fObj.getHours().toString().padStart(2, '0')}:${fObj.getMinutes().toString().padStart(2, '0')}`;
    }

    async guardar() {
        const body = {
            email: this.email,
            nombre: this.usuario,
            consultorio: this.lugar,
            fecha: this.fecha,
            hora: this.hora,
            minutos: this.minutos,
            intervalo: this.intervalo,
            colorId: this.colorId,
            creadoPor: this.creadoPor,
            prefijoGcal: this.prefijoGcal,
            etiquetaGeneral: this.etiquetaGeneral
        };
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return resp;
    }

    async cancelar() {
        if (!this.id) throw new Error('Falta id de reserva para cancelar');
        const body = {
            eventId: this.id,
            nombreUsuario: this.usuario,
            esAdmin: !!this.creadoPor
        };
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        return resp;
    }

    async imprimirTicketReserva() {
        const modT = await import('../pdf/pdf_ticket_reserva.js');
        const prefijo = this.etiquetaGeneral?.charAt(0) || 'E';
        await modT.generarTicketReserva({
            nombre: this.usuario,
            fecha: this.fecha,
            hora: this.h_inicio,
            consultorio: this.lugar,
            email: this.email,
            intervalo: this.intervalo,
            inicio: this.h_inicio,
            fin: this.h_fin,
            espacio: prefijo + String(this.lugar),
            usuario: this.usuario,
            realizadaPorAdmin: !!this.creadoPor,
            fechaCreacion: this.fechaCreacion || null
        });
    }

    async imprimirTicketCancelacion() {
         const modCancel = await import('../pdf/pdf_ticket_cancela.js');
         const reservaCancelada = {
            usuario:      this.usuario      || '',
            email:        this.email        || '',
            fecha:        this.fecha        || '',
            inicio:       this.h_inicio     || '',
            fin:          this.h_fin        || '',
            intervalo:    this.intervalo    || '',
            espacio:      this.lugar        || '',
            creadoPor:    this.creadoPor    || '',
            canceladoPor: this.canceladoPor || this.usuario || '',
            fechaCreacion: this.fechaCreacion || null
        };
        await modCancel.generarTicketCancelacion(reservaCancelada);
    }
}