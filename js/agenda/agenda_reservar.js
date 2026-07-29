// js/agenda/agenda_reservar.js
// Flujo completo de nueva reserva: modal de duración, validaciones,
// construcción del objeto Reserva, guardar y ticket de confirmación.

import { APP_CONFIG } from '../config.js';
import { mostrarToast } from '../utils.js';

// Estado compartido — se inyecta desde agenda_v2.js al inicializar
let _state = null;
export function initReservar(state) { _state = state; }

window.iniciarReservaV2 = async function(consultorio, fecha, hora) {
    const { esAdmin, user, usuariosLista, usuarioSeleccionadoAdmin, recargarGrilla } = _state;

    // Validar día laboral
    const fechaObjVal = new Date(fecha + 'T00:00:00');
    if (APP_CONFIG.diasLaborales && !APP_CONFIG.diasLaborales.includes(fechaObjVal.getDay())) {
        mostrarToast("No se pueden agendar turnos en días no laborales.", "warning");
        return;
    }

    // Validar que no sea en el pasado (solo usuarios comunes)
    if (!esAdmin) {
        const [hStr, mStr] = hora.split(':');
        if (new Date(`${fecha}T${hStr}:${mStr}:00`) < new Date()) {
            mostrarToast("No puedes agendar un turno en un horario que ya pasó.", "warning");
            return;
        }
    }

    // Calcular opciones de duración válidas según horario de cierre
    const opcionesIntervalos = APP_CONFIG.horarios.intervalos || [60, 90];
    const dayOfWeek = new Date(fecha + 'T00:00:00').getDay();
    let horaCierre = APP_CONFIG.horarios.fin;
    if (APP_CONFIG.horariosEspeciales?.[dayOfWeek]) {
        horaCierre = APP_CONFIG.horariosEspeciales[dayOfWeek].fin;
    }
    const [hStr, mStr] = hora.split(':');
    const minutosDisponibles = (horaCierre * 60) - (parseInt(hStr, 10) * 60 + parseInt(mStr, 10));
    let opcionesValidas = opcionesIntervalos.filter(min => min <= minutosDisponibles);
    if (APP_CONFIG.horarios.restriccionCierreSoloUsuarios && esAdmin) {
        opcionesValidas = opcionesIntervalos;
    }
    if (opcionesValidas.length === 0) {
        mostrarToast(`No hay tiempo suficiente antes del cierre (${horaCierre}:00 hs).`, "warning");
        return;
    }

    // Modal de selección de duración
    const intervalo = await seleccionarDuracion(consultorio, hora, opcionesValidas);
    if (!intervalo) return;

    // Determinar usuario a reservar
    let emailReserva = user.email;
    let nombreReserva = user.nombre || user.email;
    let creadoPor = null;

    if (esAdmin) {
        if (!usuarioSeleccionadoAdmin) {
            mostrarToast("⚠️ Seleccione un usuario del combo 'Agendando para:' antes de reservar.", "warning");
            return;
        }
        // Asignar siempre creadoPor cuando la acción la realiza un admin (incluso si selecciona su propio usuario)
        const sel = usuariosLista.find(u => u.email === usuarioSeleccionadoAdmin);
        if (sel) {
            emailReserva = sel.email;
            nombreReserva = sel.nombre || sel.email;
        }
        creadoPor = `${user.nombre} <${user.email}>`;
    }

    const [hh, mm] = hora.split(':').map(Number);
    const gridContainer = document.querySelector('#grid-container');
    const originalHTML = gridContainer.innerHTML;
    gridContainer.innerHTML = '<div style="padding:40px;text-align:center;color:#666;">⌛ Procesando reserva...</div>';

    try {
        // Determinar color del espacio
        let colorAUsar = "1";
        if (APP_CONFIG.espacios?.items) {
            const esp = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === parseInt(consultorio));
            if (esp) colorAUsar = esp.colorGoogle;
        } else if (APP_CONFIG.coloresConsultorios) {
            colorAUsar = APP_CONFIG.coloresConsultorios[consultorio] || "1";
        }

        const { Reserva } = await import('../modelo/reserva.js');
        const reserva = new Reserva(
            nombreReserva,
            fecha,
            `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`,
            consultorio,
            creadoPor,
            null,
            emailReserva,
            null,
            intervalo,
            colorAUsar,
            APP_CONFIG.espacios?.prefijoGeneral || 'C',
            APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio'
        );

        const resp = await reserva.guardar();
        // Leer el body UNA sola vez — resp.text() solo se puede consumir una vez
        let respJson = null;
        let respText = null;
        try {
            respText = await resp.text();
            respJson = JSON.parse(respText);
        } catch {}

        if (resp.ok) {
            mostrarToast("✅ Turno agendado correctamente.", "success");
            try {
                reserva.fechaCreacion = respJson?.created || null;
                await reserva.imprimirTicketReserva();
            } catch(e) {
                console.error("Error al generar comprobante:", e);
            }
            await recargarGrilla();
        } else if (resp.status === 409) {
            // Conflicto de concurrencia — otro usuario reservó el mismo slot al mismo tiempo
            mostrarToast("⚠️ Este horario acaba de ser tomado por otro usuario. La agenda se actualizó.", "warning");
            await recargarGrilla(); // Recargar para mostrar el slot ya ocupado
        } else {
            mostrarToast("❌ Error: " + (respJson?.error || "No se pudo completar la reserva."), "error");
            await recargarGrilla();
        }
    } catch (e) {
        console.error("Error de conexión:", e);
        mostrarToast("Error de conexión.", "error");
        gridContainer.innerHTML = originalHTML;
    }
};

// Modal de selección de duración — devuelve una Promise con los minutos elegidos o null
function seleccionarDuracion(consultorio, hora, opciones) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="modal-duracion" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:9999;">
                <div style="background:var(--white,white);color:var(--text-main,#333);padding:25px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.2);max-width:400px;width:90%;text-align:center;">
                    <h3 style="margin-top:0;color:var(--primary,#2c3e50);">Seleccionar Duración</h3>
                    <p style="margin-bottom:20px;color:#666;">¿Cuánto tiempo desea reservar el espacio ${consultorio} a las ${hora}?</p>
                    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
                        ${opciones.map(min => `
                            <button class="btn-duracion-opcion" data-minutos="${min}" style="padding:12px;font-size:1.1rem;background:var(--bg-zebra,#f8f9fa);border:1px solid var(--border,#ccc);border-radius:8px;cursor:pointer;transition:all 0.2s;">
                                ${min} minutos
                            </button>
                        `).join('')}
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:10px;">
                        <button id="btn-aceptar-duracion" style="flex:1;padding:10px 20px;background:var(--primary,#007bff);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;" disabled>Aceptar</button>
                        <button id="btn-cancelar-duracion" style="flex:1;padding:10px 20px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Cancelar</button>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('modal-duracion');
        const btnAceptar = document.getElementById('btn-aceptar-duracion');
        let seleccion = null;

        modal.querySelectorAll('.btn-duracion-opcion').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.btn-duracion-opcion').forEach(b => {
                    b.style.background = 'var(--bg-zebra,#f8f9fa)';
                    b.style.color = 'var(--text-main,black)';
                    b.classList.remove('seleccionado');
                });
                btn.style.background = 'var(--primary,#007bff)';
                btn.style.color = 'white';
                btn.classList.add('seleccionado');
                seleccion = parseInt(btn.getAttribute('data-minutos'), 10);
                btnAceptar.disabled = false;
            });
            btn.addEventListener('mouseover', () => { if (!btn.classList.contains('seleccionado')) btn.style.opacity = '0.8'; });
            btn.addEventListener('mouseout',  () => { if (!btn.classList.contains('seleccionado')) { btn.style.opacity = '1'; btn.style.background = 'var(--bg-zebra,#f8f9fa)'; } });
        });

        btnAceptar.addEventListener('click', () => { if (seleccion) { resolve(seleccion); modal.remove(); } });
        document.getElementById('btn-cancelar-duracion').addEventListener('click', () => { resolve(null); modal.remove(); });
    });
}