// bloqueos.js
// Lógica para bloqueo de horarios por admin/gestor generando reservas "Bloqueada" en los consultorios seleccionados

import { APP_CONFIG } from './config.js';
import { getAuthHeaders, mostrarToast, mostrarModalConfirmacion } from './utils.js';

/**
 * Abre un modal/formulario para seleccionar día, hora inicio/fin, consultorios y bloquea los horarios
 * Solo para admin/gestor
 */
export function renderBloqueoHorarios(container, usuario) {
        container.innerHTML = `
            <div class="bloqueos-header" style="margin-bottom: 20px;">
                <h2 class="module-title">Bloqueo de Horarios</h2>
            </div>
            <div class="informe-container" style="max-width: 900px; margin: 0 auto; padding: 20px; background: var(--white); border-radius: var(--radius-card, 8px); box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <form id="form-bloqueo-horarios" class="informe-form" style="display: flex; flex-direction: column; gap: 20px; align-items: stretch; width: 100%; box-sizing: border-box;">
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; width: 100%;">
                        <div style="display: flex; gap: 15px; flex: 1; min-width: 320px; align-items: flex-end;">
                            <div class="form-group" style="display: flex; flex-direction: column; flex: 1;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">DÍA</label>
                                <input type="date" id="bloqueo-dia" required style="padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-btn, 6px); width: 100%; box-sizing: border-box; font-family: inherit; height: 42px; background: var(--white); color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                            </div>

                            <div class="form-group" style="display: flex; align-items: center; background: var(--bg-zebra); padding: 0 15px; border-radius: var(--radius-btn, 6px); border: 1px solid var(--border); box-sizing: border-box; height: 42px; white-space: nowrap;">
                                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 500; color: var(--text-main); font-size: 0.95rem; margin: 0;">
                                    <input type="checkbox" id="bloqueo-dia-completo" style="width: 18px; height: 18px; min-width: 0 !important; cursor: pointer; accent-color: var(--primary);">
                                    Día completo
                                </label>
                            </div>
                        </div>

                        <div style="display: flex; gap: 15px; flex: 1; min-width: 300px;">
                            <div class="form-group" style="display: flex; flex-direction: column; flex: 1;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">HORA INICIO</label>
                                <input type="time" id="bloqueo-hora-inicio" value="08:00" required style="padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-btn, 6px); width: 100%; box-sizing: border-box; font-family: inherit; background: var(--white); height: 42px; color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                            </div>
                            
                            <div class="form-group" style="display: flex; flex-direction: column; flex: 1;">
                                <label style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">HORA FIN</label>
                                <input type="time" id="bloqueo-hora-fin" value="21:00" required style="padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-btn, 6px); width: 100%; box-sizing: border-box; font-family: inherit; background: var(--white); height: 42px; color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="display: flex; flex-direction: column; width: 100%;">
                        <label style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 12px;">${APP_CONFIG.espacios?.etiquetaGeneralPlural ? APP_CONFIG.espacios.etiquetaGeneralPlural.toUpperCase() : 'ESPACIOS'}</label>
                        <div id="bloqueo-consultorios-list" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; background: var(--white); padding: 25px; border: 1px solid var(--border); border-radius: var(--radius-btn, 6px);"></div>
                    </div>

                    <div class="form-group" style="display: flex; flex-direction: column; width: 100%;">
                        <label style="font-weight: 600; color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; margin-bottom: 8px;">OBSERVACIÓN (OPCIONAL)</label>
                        <input type="text" id="bloqueo-observacion" maxlength="100" placeholder="Ej: Mantenimiento, Feriado..." style="padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-btn, 6px); width: 100%; box-sizing: border-box; font-family: inherit; background: var(--white); height: 42px; color: var(--text-main); font-size: 0.95rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                    </div>

                    <div style="display: flex; justify-content: flex-end; margin-top: 10px; width: 100%;">
                        <button type="submit" class="btn btn-primary" style="padding: 10px 24px; height: 42px; font-size: 0.95rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;">Bloquear Horarios</button>
                    </div>
                </form>
            </div>
        `;
        // Consultorios/Espacios checkboxes
        let consultorios = [];
        if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
            consultorios = APP_CONFIG.espacios.items.map(item => parseInt(item.id));
        } else {
            consultorios = APP_CONFIG.consultorios || [1,2,3,4,5];
        }

        const list = container.querySelector('#bloqueo-consultorios-list');
        list.innerHTML = consultorios.map(c => {
            const prefix = APP_CONFIG.espacios?.prefijoGeneral || 'C';
            let labelText = c === 0 ? `${prefix}0 (Todos)` : `${prefix}${c}`;
            
            // Usar nombre corto si está disponible
            if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
                const item = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === c);
                if (item) labelText = item.nombreCorto;
            }

            return `<label style="display: flex; align-items: center; gap: 15px; cursor: pointer; font-weight: 500; color: var(--text-main); justify-content: flex-start; font-size: 0.95rem;"><input type='checkbox' value='${c}' class='chk-consultorio' checked style="width: 18px; height: 18px; min-width: 0 !important; cursor: pointer; accent-color: var(--primary);"> ${labelText}</label>`;
        }).join('');
        
        // Lógica de "Seleccionar todos" con C0
        const chkConsultorios = Array.from(list.querySelectorAll('.chk-consultorio'));
        const chkC0 = chkConsultorios.find(cb => cb.value == '0');
        const chkResto = chkConsultorios.filter(cb => cb.value != '0');

        if (chkC0) {
            // Si se marca/desmarca C0, se marcan/desmarcan todos los demás
            chkC0.addEventListener('change', (e) => {
                chkResto.forEach(cb => cb.checked = e.target.checked);
            });

            // Si se desmarca cualquier otro, se desmarca C0. Si se marcan todos, se marca C0.
            chkResto.forEach(cb => {
                cb.addEventListener('change', () => {
                    if (!cb.checked) {
                        chkC0.checked = false;
                    } else {
                        const todosMarcados = chkResto.every(c => c.checked);
                        chkC0.checked = todosMarcados;
                    }
                });
            });
        }

        // Día completo: deshabilita horas y fija valores
        const diaCompletoChk = container.querySelector('#bloqueo-dia-completo');
        const horaInicio = container.querySelector('#bloqueo-hora-inicio');
        const horaFin = container.querySelector('#bloqueo-hora-fin');
        diaCompletoChk.onchange = () => {
            horaInicio.disabled = diaCompletoChk.checked;
            horaFin.disabled = diaCompletoChk.checked;
            if (diaCompletoChk.checked) {
                horaInicio.value = '08:00';
                horaFin.value = '21:00';
            }
        };
        // Submit
        container.querySelector('#form-bloqueo-horarios').onsubmit = async (e) => {
            e.preventDefault();
            //const fecha = new Date(container.querySelector('#bloqueo-dia').value);
            const [fy, fm, fd] = container.querySelector('#bloqueo-dia').value.split('-').map(Number);
            const fecha = new Date(fy, fm - 1, fd);
            
            let horaIni = 8, horaFinVal = 21;
            if (!diaCompletoChk.checked) {
                const [h1,m1] = container.querySelector('#bloqueo-hora-inicio').value.split(':').map(Number);
                const [h2,m2] = container.querySelector('#bloqueo-hora-fin').value.split(':').map(Number);
                horaIni = h1;
                horaFinVal = h2;
            }
            const consultoriosSel = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
            if (!consultoriosSel.length) { 
                mostrarToast('Seleccione al menos un consultorio', 'warning');
                return; 
            }
            const observacion = container.querySelector('#bloqueo-observacion').value || '';
            const fechaString = container.querySelector('#bloqueo-dia').value;
            const [anio, mes, dia] = fechaString.split('-');
            const fechaFormateada = `${dia}/${mes}/${anio}`;

            const contenido = `
                <p style="margin-bottom: 20px; color: #666;">
                    ¿Está seguro que desea bloquear ${diaCompletoChk.checked ? 'todo el día' : `de ${horaIni.toString().padStart(2, '0')}:00 a ${horaFinVal.toString().padStart(2, '0')}:00`} 
                    el <strong>${fechaFormateada}</strong> 
                    en <strong>${consultoriosSel.length === 1 && consultoriosSel[0] === '0' ? 'todos los espacios' : consultoriosSel.map(c => c=='0'?'Todos':(APP_CONFIG.espacios?.prefijoGeneral||'C')+c).join(', ')}</strong>?
                </p>`;

            mostrarModalConfirmacion(
                "Confirmar Bloqueo",
                contenido,
                "Bloquear",
                async (btnConfirmar, btnCancelar, modal) => {
                    btnConfirmar.disabled = true;
                    btnConfirmar.innerText = 'Bloqueando...';

                    await bloquearHorarios({ fecha, horaInicio: horaIni, horaFin: horaFinVal, consultorios: consultoriosSel, diaCompleto: diaCompletoChk.checked, usuario, observacion });
                    
                    modal.remove();

                    // Usar el sistema de notificaciones toast
                    mostrarToast('Bloqueo realizado con éxito.', 'success');
                    
                    // Limpiar formulario
                    container.querySelector('#form-bloqueo-horarios').reset();
                }
            );
        };
}

/**
 * Genera reservas "Bloqueada" para los consultorios y horarios seleccionados
 * @param {Date} fecha - Día a bloquear
 * @param {number} horaInicio - Hora de inicio
 * @param {number} horaFin - Hora de fin
 * @param {Array<string>} consultorios - IDs de consultorios a bloquear
 * @param {boolean} diaCompleto - Si se bloquea todo el día
 * @param {string} usuario - Email del admin/gestor
 */
/**
 * Automatiza la creación de reservas bloqueadas
 * @param {Object} params
 * @param {Date} params.fecha
 * @param {number} params.horaInicio
 * @param {number} params.horaFin
 * @param {Array<string>} params.consultorios
 * @param {boolean} params.diaCompleto
 * @param {Object} params.usuario - Objeto usuario {nombre, email, rol}
 */
export async function bloquearHorarios({ fecha, horaInicio, horaFin, consultorios, diaCompleto, usuario, observacion }) {
    // Color rojo solo si se bloquean todos los consultorios, si no, color por consultorio
    let todosConsultorios = [];
    if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
        todosConsultorios = APP_CONFIG.espacios.items.map(item => item.id);
    } else {
        todosConsultorios = (APP_CONFIG.consultorios || [1,2,3,4,5]).map(String);
    }
    
    const bloquearTodos = consultorios.length === todosConsultorios.length && consultorios.every(c => todosConsultorios.includes(c.toString()));
    const nombreUsuario = usuario && usuario.nombre ? usuario.nombre : 'Admin';
    const prefix = APP_CONFIG.espacios?.prefijoGeneral || 'C';

    if (bloquearTodos) {
        // Generar una única reserva C0 (no crear para c1-c5)
        const colorId = '11';
        const tieneObs = observacion && observacion.trim().length > 0;
        const body = {
            email: usuario.email,
            nombre: 'Bloqueada',
            consultorio: '0',
            fecha: fecha.toISOString().slice(0,10),
            hora: horaInicio,
            minutos: 0,
            intervalo: (horaFin - horaInicio) * 60,
            colorId,
            creadoPor: nombreUsuario,
            observacion: observacion || '',
            summary: `${prefix}0: Bloqueada${tieneObs ? '-' + observacion.trim() : ''}`,
            prefijoGcal: prefix,
            etiquetaGeneral: APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio'
        };
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            let msg = 'Error desconocido';
            try {
                const data = await resp.json();
                msg = data.error || JSON.stringify(data);
            } catch {}
            
            mostrarToast(`Error al bloquear C0 ${horaInicio}:00 - ${msg}`, 'error');
        }
        // Refuerzo: limpiar consultorios para evitar bucle accidental
        consultorios.length = 0;
        return; // No crear reservas para c1-c5
    }
    // Si no es bloqueo total, crear reservas individuales
    for (const consultorio of consultorios) {
        let colorId = '1';
        if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
            const item = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === parseInt(consultorio));
            if (item) colorId = item.colorGoogle;
        } else if (APP_CONFIG.coloresConsultorios) {
            colorId = APP_CONFIG.coloresConsultorios[consultorio] || '1';
        }
        
        const tieneObs = observacion && observacion.trim().length > 0;
        const body = {
            email: usuario.email,
            nombre: 'Bloqueada',
            consultorio,
            fecha: fecha.toISOString().slice(0,10),
            hora: horaInicio,
            minutos: 0,
            intervalo: (horaFin - horaInicio) * 60,
            colorId,
            creadoPor: nombreUsuario,
            observacion: observacion || '',
            summary: `${prefix}${consultorio}: Bloqueada${tieneObs ? '-' + observacion.trim() : ''}`,
            prefijoGcal: prefix,
            etiquetaGeneral: APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio'
        };
        // Llamar a la API de reservas (Netlify Function)
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            let msg = 'Error desconocido';
            try {
                const data = await resp.json();
                msg = data.error || JSON.stringify(data);
            } catch {}
            
            mostrarToast(`Error al bloquear C${consultorio} ${horaInicio}:00 - ${msg}`, 'error');
        }
    }
}
