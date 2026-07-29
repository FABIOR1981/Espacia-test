/**
 * Formatea una fecha a DD/MM/AA
 * @param {string|Date} fechaStr
 * @returns {string}
 */
export function parseFecha(fechaInput) {
    if (!fechaInput) return null;

    if (fechaInput instanceof Date) {
        if (isNaN(fechaInput)) return null;
        return fechaInput;
    }

    const value = String(fechaInput).trim();

    // DD/MM/YY o DD/MM/YYYY
    let match = value.match(/^([0-9]{1,2})\/([0-9]{1,2})\/(\d{2}|\d{4})$/);
    if (match) {
        let dia = parseInt(match[1], 10);
        let mes = parseInt(match[2], 10);
        let ano = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
        if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
        return new Date(ano, mes - 1, dia);
    }

    // YYYY-MM-DD o variantes con hora
    match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](.+))?$/);
    if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        if (match[4]) {
            // Con hora/timezone, puede ser Z o con offset
            const d = new Date(value);
            return isNaN(d) ? null : d;
        }
        // Sin hora, interpretar como fecha local para evitar desplazamientos UTC inesperados
        const d = new Date(year, month - 1, day);
        return isNaN(d) ? null : d;
    }

    // Intentamos parse genérico con Date (cuidado con locale), fallback de último recurso
    const d = new Date(value);
    return isNaN(d) ? null : d;
}

export function formatFechaCorta(fechaStr) {
    const fecha = parseFecha(fechaStr);
    if (!fecha) return '';
    return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth()+1).toString().padStart(2, '0')}/${fecha.getFullYear().toString().slice(-2)}`;
}

export function formatFechaISO(fechaStr) {
    const fecha = parseFecha(fechaStr);
    if (!fecha) return '';
    return `${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}`;
}

export function calcularHoraFin(hInicio, intervaloMinutos) {
    if (!hInicio || !intervaloMinutos) return '';
    const [h, m] = String(hInicio).split(':').map(Number);
    if (isNaN(h) || isNaN(m) || isNaN(intervaloMinutos)) return '';
    const f = new Date(2000, 0, 1, h, m);
    f.setMinutes(f.getMinutes() + Number(intervaloMinutos));
    return `${f.getHours().toString().padStart(2,'0')}:${f.getMinutes().toString().padStart(2,'0')}`;
}
import { APP_CONFIG } from './config.js';

// js/utils.js
/**
 * Crea un combo (select) de usuarios.
 * @param {Array} usuariosLista - Array de usuarios (con nombre y email).
 * @param {Object} opciones - Opciones opcionales: id, name, clase, includeTodos, valueKey, textKey.
 * @returns {HTMLSelectElement} El elemento select generado.
 */
export function createComboUsuarios(usuariosLista, opciones = {}) {
    const {
        id = '',
        name = '',
        clase = '',
        includeTodos = true,
        valueKey = 'email',
        textKey = 'nombre'
    } = opciones;
    const select = document.createElement('select');
    if (id) select.id = id;
    if (name) select.name = name;
    if (clase) select.className = clase;
    if (includeTodos) {
        const optTodos = document.createElement('option');
        optTodos.value = '';
        optTodos.textContent = 'Todos';
        select.appendChild(optTodos);
    }
    usuariosLista.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u[valueKey] || '';
        opt.textContent = u[textKey] || u[valueKey] || '';
        select.appendChild(opt);
    });
    return select;
}
// Funciones de utilidad compartidas en el frontend

/**
 * Obtiene los headers de autorización con el JWT.
 * @returns {Object} Objeto con los headers.
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('consAge_token') || sessionStorage.getItem('consAge_token');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Genera un hash SHA-256 de una contraseña.
 * @param {string} pw - La contraseña en texto plano.
 * @returns {Promise<string>} El hash hexadecimal de la contraseña.
 */
export async function hashPassword(pw) {
    if (!pw) return '';
    const enc = new TextEncoder();
    const data = enc.encode(pw);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Muestra una notificación tipo toast en la pantalla
 * @param {string} mensaje - El texto a mostrar
 * @param {string} tipo - 'success', 'error', 'warning', o 'info'
 */
export function mostrarToast(mensaje, tipo = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    let bgColor = '#333';
    if (tipo === 'success') bgColor = '#2ecc71';
    if (tipo === 'error') bgColor = '#e74c3c';
    if (tipo === 'warning') bgColor = '#f39c12';

    toast.style.cssText = `
        background-color: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: sans-serif;
        font-size: 14px;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 250px;
    `;

    toast.innerHTML = `
        <span>${mensaje}</span>
        <button style="background:none; border:none; color:white; cursor:pointer; font-size:16px; margin-left:15px;">&times;</button>
    `;

    toast.querySelector('button').onclick = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    };

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, window.APP_CONFIG?.toastDuracion || APP_CONFIG?.toastDuracion || 3000);
}

/**
 * Muestra un modal de confirmación genérico
 * @param {string} titulo - Título del modal
 * @param {string} HTMLcontenido - Contenido HTML del modal (ej. texto de la pregunta, inputs adicionales)
 * @param {string} textoConfirmar - Texto del botón de confirmación (ej. "Sí, Cancelar", "Aceptar")
 * @param {Function} onConfirm - Callback asíncrono o síncrono al hacer clic en confirmar que recibe (botonConfirmar, btnCancelar, modal)
 * @param {string} [textoCancelar="Volver"] - Texto del botón secundario/cancelar
 * @param {string} [colorConfirmar="#e74c3c"] - Color de fondo del botón principal 
 */
export function mostrarModalConfirmacion(titulo, HTMLcontenido, textoConfirmar, onConfirm, textoCancelar = "Volver", colorConfirmar = "#e74c3c") {
    const minWidth = window.innerWidth < 500 ? "95%" : "400px";

    const modalHtml = `
        <div id="modal-global-confirmacion" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;">
            <div style="background: var(--white, white); color: var(--text-main, #333); padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); max-width: 400px; width: ${minWidth}; text-align: center;">
                <h3 style="margin-top: 0; color: ${colorConfirmar};">${titulo}</h3>
                
                <div style="margin-bottom: 20px; color: #666; font-size: 1rem;">
                    ${HTMLcontenido}
                </div>
                
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    <button id="btn-global-confirmar" style="flex: 1; padding: 10px 20px; background: ${colorConfirmar}; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">${textoConfirmar}</button>
                    <button id="btn-global-cancelar" style="flex: 1; padding: 10px 20px; background: var(--bg-zebra, #f8f9fa); color: #333; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; font-weight: bold;">${textoCancelar}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('modal-global-confirmacion');
    const btnConfirmar = document.getElementById('btn-global-confirmar');
    const btnCancelar = document.getElementById('btn-global-cancelar');

    btnCancelar.onclick = () => {
        modal.remove();
    };

    btnConfirmar.onclick = async () => {
        await onConfirm(btnConfirmar, btnCancelar, modal);
    };
}

function _normalize(s){
  return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

export function getRealizadoPor(reserva){
  if(!reserva) return '';
  const owner = (reserva.usuario || '').toString().trim();

  let creado = (reserva.creadoPor || '').toString().trim();
  if(!creado){
    const m = (reserva.description || '').toString().match(/Reserva realizada por:\s*([^\n<]+)/i);
    if(m) creado = m[1].trim();
  }
  if(creado){
    const m = creado.match(/^(.+?)(?:\s*<|$)/);
    const creadoName = m ? m[1].trim() : creado;
    if(owner && _normalize(owner) === _normalize(creadoName)) return owner;
    return 'Administración';
  }

  if(reserva.realizadaPorAdmin) return 'Administración';
  return owner || '';
}

export function getCanceladoPor(reserva) {
    if (!reserva) return '';

    // 1. Extraer datos básicos
    const estado = (reserva.estado || '').toString().toLowerCase();
    const summary = (reserva.summary || '').toString().toLowerCase();
    const description = (reserva.description || '').toString();

    

    // 3. Obtener el dueño
    let owner = (reserva.usuario || '').toString().trim();
    if (!owner) {
        const m = summary.match(/Reserva para:\s*([^\n<]+)/i) || description.match(/Reserva para:\s*([^\n<]+)/i);
        if (m) owner = m[1].trim();
    }

    // 4. Obtener quién canceló (buscando en ambos campos)
    let cancelRaw = (reserva.canceladoPor || '').toString().trim();
    if (!cancelRaw) {
        const m = description.match(/Reserva Cancelada por:\s*([^\n<]+)/i) || summary.match(/Reserva Cancelada por:\s*([^\n<]+)/i);
        if (m) cancelRaw = m[1].trim();
    }

    // 5. Lógica de comparación mejorada (igual que en getRealizadoPor)
    if (cancelRaw) {
        // Limpiamos posibles sufijos de fecha/hora añadidos al registro
        // Ej: "Mariana Roberto CLI el 29/3/2026, 8:03:59 p. m." -> "Mariana Roberto CLI"
        let cancelClean = cancelRaw.replace(/\s+el\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*$/i, '').trim();
        // Limpiamos emails si existen: "Nombre <email@...>" -> "Nombre"
        const m = cancelClean.match(/^(.+?)(?:\s*<|$)/);
        const cancelName = m ? m[1].trim() : cancelClean;

        if (owner && _normalize(owner) === _normalize(cancelName)) {
            return owner;
        }
        // Mantener comportamiento previo: si quien canceló NO es el titular, mostrar 'Administración'
        return 'Administración';
    }

    // Si no hay datos de cancelación pero el evento está marcado como cancelado, devolver 'Administración'
    if (estado && estado.includes('cancel')) return 'Administración';

    // En cualquier otro caso no hay información de cancelación
    return '';
}