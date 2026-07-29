// js/persistencia/abm_usuario.js
// ABM de Usuarios — Orden Alfabético y Lógica FabioRE

import { APP_CONFIG } from '../config.js';
import { getAuthHeaders, hashPassword, mostrarToast, mostrarModalConfirmacion } from '../utils.js';

let usuarios = [];

export async function renderAbmUsu2(container) {
    container.innerHTML = `
        <div class="abmusu-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                <h2 class="module-title" style="margin:0;">👥 Gestión de Usuarios</h2>
                <button id="btn-nuevo-usuario" style="background:var(--primary); color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.95rem;">
                    + Nuevo Usuario
                </button>
            </div>
            <div style="margin-bottom:16px; display:flex; gap:8px; align-items:center;">
                <input id="filtro-usuarios" type="text" placeholder="Filtrar por nombre, ID o rol..." style="width:320px; padding:8px; border:1px solid #ccc; border-radius:6px; font-size:1rem;">
                <button id="filtro-clear-btn" title="Limpiar filtro" style="background:#f1f1f1; border:none; border-radius:6px; padding:8px 12px; cursor:pointer; font-size:1.1em; color:#888;">✖</button>
            </div>
            <div class="table-responsive">
                <table id="usuarios-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>ID Usuario</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usuarios-tbody">
                        <tr><td colspan="5" style="text-align:center; color:#888; padding:30px;">Cargando usuarios...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.querySelector('#btn-nuevo-usuario').onclick = () => abrirModal(null);
    await cargarUsuarios();

    // Filtro local
    const filtroInput = container.querySelector('#filtro-usuarios');
    filtroInput.addEventListener('input', function() {
        const texto = this.value.toLowerCase();
        if (!texto) {
            renderTabla(usuarios);
            return;
        }
        const filtrados = usuarios.filter(u =>
            (u.nombre || '').toLowerCase().includes(texto) ||
            (u.nomUsu || '').toLowerCase().includes(texto) ||
            (u.rol || '').toLowerCase().includes(texto)
        );
        renderTabla(filtrados);
    });

    // Botón para limpiar filtro-input
    const filtroClearBtn = container.querySelector('#filtro-clear-btn');
    if (filtroClearBtn) {
        filtroClearBtn.addEventListener('click', function() {
            filtroInput.value = '';
            renderTabla(usuarios);
        });
    }
    }


async function cargarUsuarios() {
    try {
        const resp = await fetch('/.netlify/functions/get-usuarios', { headers: getAuthHeaders() });
        if (!resp.ok) throw new Error();
        let data = await resp.json();

        // --- ORDEN ALFABÉTICO POR NOMBRE ---
        usuarios = data.sort((a, b) => {
            const nomA = (a.nombre || "").toLowerCase();
            const nomB = (b.nombre || "").toLowerCase();
            return nomA.localeCompare(nomB);
        });

        renderTabla();
    } catch (e) {
        mostrarToast('Error al cargar la lista de usuarios', 'error');
    }
}

function renderTabla() {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;

    // Permitir recibir lista filtrada
    let lista = Array.isArray(arguments[0]) ? arguments[0] : usuarios;

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888; padding:30px;">No hay usuarios registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map((u) => {
        const activo = u.activo !== false;
        const idUsuario = u.nomUsu || '';
        return `
            <tr style="${activo ? '' : 'opacity:0.55;'}">
                <td>${u.nombre || '-'} </td>
                <td style="font-family:monospace; font-weight:bold; color:var(--primary);">${idUsuario || '-'}</td>
                <td style="text-transform:capitalize; font-size:0.9rem;">${u.rol || '-'}</td>
                <td>${activo ? '✅ <span style="color:#27ae60;">Activo</span>' : '🚫 <span style="color:#e74c3c;">Inactivo</span>'}</td>
                <td>
                    <button data-edit="${idUsuario}" title="Editar" style="background:var(--primary);color:white;margin-right:4px;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;">✏️</button>
                    ${activo 
                        ? `<button data-baja="${idUsuario}" title="Inactivar" style="background:#e74c3c;color:white;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;">🗑️</button>`
                        : `<button data-alta="${idUsuario}" title="Reactivar" style="background:#27ae60;color:white;border:none;padding:5px 8px;border-radius:4px;cursor:pointer;">🔄</button>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => abrirModal(btn.dataset.edit));
    tbody.querySelectorAll('[data-baja]').forEach(btn => btn.onclick = () => confirmarBaja(btn.dataset.baja));
    tbody.querySelectorAll('[data-alta]').forEach(btn => btn.onclick = () => reactivarUsuario(btn.dataset.alta));
}

function buscarIndiceUsuario(nomUsu) {
    if (!nomUsu) return -1;
    return usuarios.findIndex(u => (u.nomUsu || '').trim() === nomUsu.trim());
}

function abrirModal(idOrNomUsu) {
    const idx = buscarIndiceUsuario(idOrNomUsu);
    const esEdicion = idx >= 0;
    const u = esEdicion ? usuarios[idx] : {};
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const espaciosCantidad = typeof APP_CONFIG.espacios === 'object' ? APP_CONFIG.espacios.items.length - 1 : 5;
    const espaciosEtiqueta = APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio';

    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px; width:95%; background:white; padding:24px; border-radius:12px; margin: 40px auto; box-shadow: 0 8px 30px rgba(0,0,0,0.3); font-family: sans-serif;">
            <h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:12px;">${esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>

            <form id="form-usuario-modal">
                <div style="margin-bottom:12px;">
                    <label style="display:block; font-weight:bold; font-size:0.85rem; margin-bottom:4px;">Nombre completo *</label>
                    <input type="text" id="abm-nombre" value="${u.nombre || ''}" placeholder="Ej: Juan Pérez" required style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; box-sizing: border-box;">
                </div>

                <div style="margin-bottom:15px;">
                    <label style="display:block; font-weight:bold; font-size:0.85rem; margin-bottom:4px;">Nombre de usuario (ID) *</label>
                    <input type="text" id="abm-nomusu" value="${u.nomUsu || ''}" required ${esEdicion ? 'readonly' : ''} style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; background:#f8f9fa; box-sizing: border-box; ${esEdicion ? 'opacity:0.65; cursor:not-allowed;' : ''}">
                </div>

                <details style="margin-bottom:15px; border:1px solid #eee; border-radius:8px; background:#fafafa;" ${esEdicion ? 'open' : ''}>
                    <summary style="padding:10px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:var(--primary);">⚙️ Datos adicionales y Rol</summary>
                    <div style="padding:12px; border-top:1px solid #eee; background:white;">
                        <div style="margin-bottom:10px;">
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Email (Opcional)</label>
                            <input type="email" id="abm-email" value="${u.email || ''}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing: border-box;">
                        </div>
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Doc. Tipo</label>
                                <select id="abm-tipdocu" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                                    ${ (Array.isArray(APP_CONFIG.tiposDocumento) ? APP_CONFIG.tiposDocumento : ['PROF','DNI','CI']).map((tipo, index) => `
                                        <option value="${tipo}" ${u.tipdocu===tipo || (!esEdicion && !u.tipdocu && index===0) ? 'selected' : ''}>${tipo}</option>
                                    `).join('') }
                                </select>
                            </div>
                            <div style="flex:2;">
                                <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Número</label>
                                <input type="text" id="abm-documento" value="${u.documento || ''}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing: border-box;">
                            </div>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; margin-bottom:4px;">Rol del sistema</label>
                            <select id="abm-rol" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                                ${(APP_CONFIG.roles || ['admin','gestor','usuario']).map(r => 
                                    `<option value="${r}" ${u.rol===r || (!esEdicion && r==='usuario') ? 'selected' : ''}>${r}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </details>

                <div style="margin-bottom:20px;">
                    <label style="display:block; font-weight:bold; font-size:0.85rem; margin-bottom:8px;">Espacios permitidos</label>
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${Array.from({length: espaciosCantidad}, (_, i) => `
                            <label style="font-size:0.75rem; background:#eee; padding:4px 10px; border-radius:15px; cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <input type="checkbox" class="abm-consPref" value="${i+1}" ${(u.consPref||[]).includes(i+1)?'checked':''}>
                                ${espaciosEtiqueta} ${i+1}
                            </label>
                        `).join('')}
                    </div>
                </div>

                ${esEdicion ? `
                <div style="margin-bottom:20px;">
                    <label style="display:block; font-weight:bold; font-size:0.85rem; margin-bottom:4px;">Nueva Contraseña</label>
                    <input type="password" id="abm-password" placeholder="Vacío = No cambiar" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px; box-sizing: border-box;">
                </div>` : `
                <div style="background:#f1f3f5; padding:12px; border-radius:8px; font-size:0.75rem; color:#495057; margin-bottom:20px; border: 1px dashed #ced4da;">
                    🔑 Contraseña inicial: <strong>IDUsuario + 1234567</strong>
                </div>`}

                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button type="submit" id="btn-guardar" style="flex:2; background:var(--primary); color:white; border:none; padding:14px; border-radius:8px; cursor:pointer; font-weight:bold;">💾 Guardar</button>
                    <button type="button" id="btn-cancelar" style="flex:1; background:#f8f9fa; border:1px solid #ddd; padding:14px; border-radius:8px; cursor:pointer;">Cancelar</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const inputNombre = modal.querySelector('#abm-nombre');
    const inputNomUsu = modal.querySelector('#abm-nomusu');
    const inputEmail = modal.querySelector('#abm-email');
    const inputDocumento = modal.querySelector('#abm-documento');

    // Guardamos si el usuario modificó manualmente el email para no pisar cambios
    let emailAutoMode = true;

    const generarEmail = (usuarioId) => {
        const dominio = (APP_CONFIG && APP_CONFIG.usuarioEmailDominio) ? APP_CONFIG.usuarioEmailDominio : '@espacia.com.uy';
        return usuarioId ? `${usuarioId.toLowerCase()}${dominio}` : '';
    };

    const actualizarEmailSegunNomUsu = () => {
        const nomUsuVal = inputNomUsu.value.trim();
        if (emailAutoMode) {
            inputEmail.value = generarEmail(nomUsuVal);
        }
    };

    if (!esEdicion) {
        // Sugiere documento no repetido
        // Normaliza los documentos numéricos para que "00000001" y "1" se traten igual.
        const numerosExistentes = new Set(usuarios
            .map(u => parseInt((u.documento || '').toString().trim(), 10))
            .filter(n => Number.isInteger(n) && n >= 0)
        );
        let candidate = 1;
        while (numerosExistentes.has(candidate)) {
            candidate++;
        }
        if (!u.documento) {
            inputDocumento.value = String(candidate);
        }

        // Si existe nomUsu inicial, auto-cargar email
        if (inputNomUsu.value.trim()) {
            inputEmail.value = generarEmail(inputNomUsu.value.trim());
        }

        inputEmail.addEventListener('input', () => {
            const manual = inputEmail.value.trim().toLowerCase();
            emailAutoMode = manual !== generarEmail(inputNomUsu.value.trim()) && manual !== '';
        });

        inputNomUsu.addEventListener('input', actualizarEmailSegunNomUsu);

        inputNombre.addEventListener('input', () => {
            const raw = inputNombre.value.trim()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            const partes = raw.split(/\s+/).filter(p => p.length > 0);
            
            if (partes.length > 0) {
                const primero = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
                const iniciales = partes.slice(1).map(p => p.charAt(0).toUpperCase()).join('');
                inputNomUsu.value = (primero + iniciales).replace(/[^a-zA-Z0-9]/g, '');
            } else {
                inputNomUsu.value = '';
            }
            actualizarEmailSegunNomUsu();
        });
    }

    modal.querySelector('#btn-cancelar').onclick = () => modal.remove();
    
    modal.querySelector('#form-usuario-modal').onsubmit = async (e) => {
        e.preventDefault();
        const btn = modal.querySelector('#btn-guardar');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const datos = {
            nombre: inputNombre.value.trim(),
            nomUsu: inputNomUsu.value.trim(),
            email: modal.querySelector('#abm-email').value.trim(),
            tipdocu: modal.querySelector('#abm-tipdocu').value,
            documento: modal.querySelector('#abm-documento').value.trim(),
            rol: modal.querySelector('#abm-rol').value,
            consPref: Array.from(modal.querySelectorAll('.abm-consPref:checked')).map(cb => parseInt(cb.value)),
            activo: esEdicion ? usuarios[idx].activo : true
        };

        // Validar nomUsu único (insensible a mayúsculas/minúsculas)
        const nomUsuToCheck = (datos.nomUsu || '').trim().toLowerCase();
        if (!nomUsuToCheck) {
            mostrarToast('El ID de usuario (nomUsu) no puede estar vacío.', 'warning');
            btn.disabled = false;
            btn.textContent = '💾 Guardar';
            return;
        }

        // En edición no validamos contra el propio registro y no permite cambiar el nomUsu.
        if (!esEdicion) {
            const existeNomUsu = usuarios.some((u) => {
                if (!u.nomUsu) return false;
                return u.nomUsu.trim().toLowerCase() === nomUsuToCheck;
            });
            if (existeNomUsu) {
                mostrarToast('Ya existe un usuario con ese ID. Por favor elija otro.', 'warning');
                btn.disabled = false;
                btn.textContent = '💾 Guardar';
                return;
            }
        }

        if (esEdicion) {
            const newPass = modal.querySelector('#abm-password').value;
            if (newPass) datos.contrasena = await hashPassword(newPass);
            else datos.contrasena = usuarios[idx].contrasena;
            usuarios[idx] = { ...usuarios[idx], ...datos };
        } else {
            datos.contrasena = await hashPassword(datos.nomUsu + '1234567');
            datos.requiereCambioPass = true;
            usuarios.push(datos);
        }

        await guardarBackend(modal);
    };
}

async function guardarBackend(modal) {
    try {
        const resp = await fetch('/.netlify/functions/update-usuarios', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ data: usuarios })
        });
        if (resp.ok) {
            mostrarToast('Éxito: Lista de usuarios actualizada', 'success');
            if (modal) modal.remove();
            await cargarUsuarios(); // Esto vuelve a ordenar y renderizar
        } else {
            const errorBody = await resp.json().catch(() => ({}));
            const errorMessage = errorBody.error || 'Error al guardar en el servidor';
            throw new Error(errorMessage);
        }
    } catch (e) {
        mostrarToast(`Error al guardar en el servidor: ${e.message}`, 'error');
        const btn = document.querySelector('#btn-guardar');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
}

function confirmarBaja(nomUsu) {
    const idx = buscarIndiceUsuario(nomUsu);
    if (idx < 0) {
        mostrarToast('No se encontró el usuario para dar de baja.', 'error');
        return;
    }
    mostrarModalConfirmacion(
        'Inactivar Usuario',
        `<p>¿Deseas dar de baja a <strong>${usuarios[idx].nombre}</strong>?</p><p style="font-size:0.8rem; color:#666;">El usuario no podrá iniciar sesión.</p>`,
        'Inactivar',
        async (b, c, m) => {
            usuarios[idx].activo = false;
            await guardarBackend(m);
        },
        'Cancelar',
        '#e74c3c'
    );
}

async function reactivarUsuario(nomUsu) {
    const idx = buscarIndiceUsuario(nomUsu);
    if (idx < 0) {
        mostrarToast('No se encontró el usuario para reactivar.', 'error');
        return;
    }
    usuarios[idx].activo = true;
    await guardarBackend(null);
}
