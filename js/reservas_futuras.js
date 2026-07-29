import { APP_CONFIG } from './config.js';
import { getAuthHeaders, mostrarToast, mostrarModalConfirmacion, createComboUsuarios } from './utils.js';

export async function renderMisReservasFuturas(container) {
    // 1. Cargar el HTML externo
    container.innerHTML = `
        <div class="informe-container">
            <div style="margin-bottom: 20px;">
                <h2 class="module-title" id="vista-titulo">
                </h2>
            </div>

            <div id="admin-filter-container" style="display: none; margin-bottom:1.5em; background: var(--white, white); padding: 15px; border-radius: 8px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.1));">
                <label style="font-weight:600; color:#2c3e50;">Filtrar por Usuario: </label>
                <input id="input-filtro-usuario" type="text" placeholder="Escriba apellido o nombre..." 
                       style="margin-left:10px; padding:6px; border:1px solid #ced4da; border-radius:4px; width:200px;">
                
                <select id="combo-usuario-futuras" style="padding: 8px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 10px; margin-top:8px;">
                    <option value="">Todos</option>
                </select>
            </div>

            <div id="total-horas-informe"></div>
            
            <div id="contenedor-resultados">
                <p>Cargando interfaz...</p>
            </div>
        </div>
    `;

    let user = JSON.parse(localStorage.getItem('usuarioActual')) || JSON.parse(sessionStorage.getItem('usuarioActual'));
    if (!user) return;

    let esAdmin = false;
    let usuariosLista = [];
    let reservasActivas = []; // Accesible desde manejarCancelacion

    // 2. Obtener lista de usuarios para el combo (Solo si es admin)
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios', {
            headers: getAuthHeaders()
        });
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && (actual.rol === 'admin' || actual.rol === 'gestor')) esAdmin = true;
            usuariosLista = js.usuarios.filter(u => u.rol === 'usuario').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
    } catch (e) { }

    // 3. Configurar Título y Filtros
    const tituloEl = document.getElementById('vista-titulo');
    const adminFilter = document.getElementById('admin-filter-container');
    const combo = document.getElementById('combo-usuario-futuras');
    
    tituloEl.innerText = esAdmin ? 'Reservas' : 'Mis Reservas';

    if (esAdmin) {
        adminFilter.style.display = 'block';
        // Usar createComboUsuarios para generar el combo
        const comboNuevo = createComboUsuarios(usuariosLista, {
            id: 'combo-usuario-futuras',
            name: 'usuario-futuras',
            clase: '',
            includeTodos: true,
            valueKey: 'email',
            textKey: 'nombre'
        });
        comboNuevo.style.padding = '8px';
        comboNuevo.style.border = '1px solid #ced4da';
        comboNuevo.style.borderRadius = '4px';
        comboNuevo.style.marginLeft = '10px';
        comboNuevo.style.marginTop = '8px';
        // Reemplazar el combo original
        combo.replaceWith(comboNuevo);
        comboNuevo.addEventListener('change', (e) => cargarReservas(e.target.value));
        // Lógica de búsqueda en el input
        const inputFiltro = document.getElementById('input-filtro-usuario');
        inputFiltro.addEventListener('input', function() {
            const texto = this.value.toLowerCase();
            comboNuevo.innerHTML = '';
            const optTodos = document.createElement('option');
            optTodos.value = '';
            optTodos.textContent = 'Todos';
            comboNuevo.appendChild(optTodos);
            usuariosLista.forEach(u => {
                if ((u.nombre || '').toLowerCase().includes(texto) || (u.email || '').toLowerCase().includes(texto)) {
                    const opt = document.createElement('option');
                    opt.value = u.email;
                    opt.textContent = u.nombre || u.email;
                    comboNuevo.appendChild(opt);
                }
            });
        });
    }

    // --- FUNCIÓN INTERNA: renderReservasTable (Corrigiendo el error de "not defined") ---
    function renderReservasTable(reservas, containerDestino) {
        // Filtrar reservas canceladas y bloqueadas
        reservasActivas = reservas.filter(r => {
            const summary = r.summary ? r.summary.toLowerCase() : '';
            return !summary.includes('cancelada') && !summary.includes('bloqueada');
        });
        const pageSize = APP_CONFIG.pageSize || 20;
        let currentPage = 1;
        const totalPages = Math.ceil(reservasActivas.length / pageSize) || 1;

        function renderPage(page) {
            const mostrarColUsuario = esAdmin;
            let html = `<div class="table-main-container"><table class="custom-table">
                <thead><tr>
                    <th style="width: 40px;">#</th>
                    <th style="width: 90px;">Fecha</th>
                    <th style="width: 130px;">Hora (inicio - fin)</th>
                    <th style="width: 100px;">${APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio'}</th>
                    ${mostrarColUsuario ? '<th>Usuario</th>' : ''}
                    <th style="width: 90px;">Estado</th>
                    <th style="width: 110px;">Acciones</th>
                </tr></thead>
                <tbody>`;
            
            const start = (page - 1) * pageSize;
            const end = Math.min(start + pageSize, reservasActivas.length);

            for (let idx = start; idx < end; idx++) {
                const r = reservasActivas[idx];
                const d = new Date(r.start);
                const fecha = d.toLocaleDateString('es-ES');
                const startDate = d;
                const endDate = r.end ? new Date(r.end) : null;
                const horaInicio = startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const horaFin = endDate ? endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                let hora = horaFin ? `${horaInicio} - ${horaFin}` : horaInicio;
                if (endDate) {
                    const diffMin = Math.round((endDate - startDate) / (1000 * 60));
                    hora += ` (${diffMin} min)`;
                }
                const match = r.summary ? r.summary.match(/^C(\d+):/) : null;
                const consultorio = match ? `C${match[1]}` : 'N/A';
                let usuario = 'Desconocido';
                if (r.description) {
                    // Preferir el nombre de la persona para quien se reservó (formato: "Reserva para: Nombre <email>")
                    let m = r.description.match(/Reserva para:\s*(.+?)\s*<([^>]+)>/);
                    if (m) {
                        usuario = m[1];
                    } else {
                        // Si no está, fallback a quien realizó la reserva (admin)
                        m = r.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                        if (m) usuario = m[1];
                    }
                }
                // Si todavía desconocido, intentar extraer del summary (ej. "C3: Juan Pérez")
                if ((!usuario || usuario === 'Desconocido') && r.summary) {
                    const parts = r.summary.split(':');
                    if (parts.length > 1) {
                        usuario = parts[1].trim();
                    }
                }
                const ahora = new Date();
                const diffHoras = (d - ahora) / (1000 * 60 * 60);
                const puedeCancelar = diffHoras > 24;
                
                // Extraer datos para el PDF
                let emailParaPDF = '';
                let creadoPorParaPDF = '';
                if (r.description) {
                    let mEmail = r.description.match(/<([^>]+)>/);
                    if (mEmail) emailParaPDF = mEmail[1];
                    
                    let mCreado = r.description.match(/Reserva realizada por: (.+?) </);
                    if (mCreado) creadoPorParaPDF = mCreado[1];
                }
                const intervaloParaPDF = endDate ? Math.round((endDate - startDate) / (1000 * 60)) : null;
                const fechaParaPDF = d.toISOString().split('T')[0]; // YYYY-MM-DD
                
                // Guardar datos en atributos data para el botón
                const datosPDF = JSON.stringify({
                    nombre: usuario,
                    fecha: fechaParaPDF,
                    hora: horaInicio,
                    horaFin: horaFin || '',
                    consultorio: match ? match[1] : '',
                    email: emailParaPDF,
                    intervalo: intervaloParaPDF,
                    creadoPor: creadoPorParaPDF,
                    fechaCreacion: r.created || null
                }).replace(/"/g, '&quot;');

                html += `<tr>
                    <td>${idx + 1}</td>
                    <td>${fecha}</td>
                    <td>${hora}</td>
                    <td>${consultorio}</td>
                    ${mostrarColUsuario ? `<td>${usuario}</td>` : ''}
                    <td><span class="status-badge reservada">Reservada</span></td>
                    <td style="display: flex; gap: 5px; justify-content: center;">
                        <button class="btn-descargar-pdf" data-pdf="${datosPDF}" title="Descargar PDF" style="background:#27ae60; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        ${puedeCancelar 
                            ? `<button class="btn-cancelar-reserva" data-id="${r.id}" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Cancelar</button>`
                            : `<button disabled style="background:#e0e0e0; color:#888; border:none; padding:5px 10px; border-radius:4px; cursor:not-allowed;">Cancelar</button>`
                        }
                    </td>
                </tr>`;
            }
            html += `</tbody></table></div>`;
            
            // Agregar controles de paginación si hay más de una página
            if (totalPages > 1) {
                html += `
                    <div class="pagination" style="margin:15px 0; text-align:center; display: flex; justify-content: center; align-items: center; gap: 15px;">
                        <button id="pag-prev-futuras" ${page === 1 ? 'disabled' : ''} style="padding: 8px 16px; border: 1px solid var(--border, #ccc); border-radius: 4px; background: ${page === 1 ? 'var(--bg-zebra, #f8f9fa)' : 'var(--white, white)'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; color: ${page === 1 ? 'var(--text-muted, #999)' : 'var(--text-main, #333)'};">&lt; Anterior</button>
                        <span style="font-weight: 500; color: var(--text-main, #555);">Página ${page} de ${totalPages}</span>
                        <button id="pag-next-futuras" ${page === totalPages ? 'disabled' : ''} style="padding: 8px 16px; border: 1px solid var(--border, #ccc); border-radius: 4px; background: ${page === totalPages ? 'var(--bg-zebra, #f8f9fa)' : 'var(--white, white)'}; cursor: ${page === totalPages ? 'not-allowed' : 'pointer'}; color: ${page === totalPages ? 'var(--text-muted, #999)' : 'var(--text-main, #333)'};">Siguiente &gt;</button>
                    </div>
                `;
            }

            containerDestino.innerHTML = html;
            
            // Eventos de botones de la tabla
            containerDestino.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
                btn.onclick = (e) => manejarCancelacion(e);
            });
            containerDestino.querySelectorAll('.btn-descargar-pdf').forEach(btn => {
                btn.onclick = async (e) => {
                    try {
                        const datosStr = e.currentTarget.getAttribute('data-pdf');
                        const datos = JSON.parse(datosStr);
                        const { generarTicketReserva } = await import('./pdf/pdf_ticket_reserva.js');
                        await generarTicketReserva({
                            usuario:           datos.nombre,
                            email:             datos.email,
                            fecha:             datos.fecha,
                            inicio:            datos.hora,
                            fin:               datos.horaFin || '',
                            intervalo:         datos.intervalo,
                            espacio:           datos.consultorio,
                            creadoPor:         datos.creadoPor || '',
                            realizadaPorAdmin: !!datos.creadoPor,
                            fechaCreacion:     datos.fechaCreacion || null
                        });
                    } catch (err) {
                        console.error("Error al descargar PDF:", err);
                        mostrarToast("Error al generar el PDF", "error");
                    }
                };
            });

            // Eventos de paginación
            const prevBtn = document.getElementById('pag-prev-futuras');
            const nextBtn = document.getElementById('pag-next-futuras');
            
            if (prevBtn) {
                prevBtn.onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderPage(currentPage);
                    }
                };
            }
            
            if (nextBtn) {
                nextBtn.onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderPage(currentPage);
                    }
                };
            }
        }
        renderPage(currentPage);
    }

    // --- FUNCIÓN INTERNA: manejarCancelacion ---
    async function manejarCancelacion(e) {
        const id = e.target.getAttribute('data-id');
        
        const contenido = `<p style="margin-bottom: 20px; color: #666;">¿Estás seguro de que deseas cancelar esta reserva?</p>`;

        mostrarModalConfirmacion(
            "Cancelar Reserva",
            contenido,
            "Sí, Cancelar",
            async (btnConfirmar, btnCancelar, modal) => {
                btnConfirmar.disabled = true;
                btnConfirmar.innerText = 'Cancelando...';

                try {
                    // nombreUsuario = quien ejecuta (el logueado), nunca el del combo
                    const nombreUsuario = user?.nombre || user?.email?.split('@')[0].replace(/\./g, ' ') || '';
                    const esAdminCancelador = (user?.rol === 'admin' || user?.rol === 'gestor');

                    const { Reserva } = await import('./modelo/reserva.js');
                    const reserva = new Reserva();
                    reserva.id           = id;
                    reserva.canceladoPor = nombreUsuario;
                    reserva.creadoPor    = esAdminCancelador ? nombreUsuario : null;

                    // Extraer datos de la reserva para el ticket
                    const r = reservasActivas.find(r => r.id === id);
                    if (r) {
                        const { extraerDatosDescription } = await import('./agenda/agenda_cancelar.js');
                        const datos = extraerDatosDescription(r.summary || '', r.description || '');
                        reserva.usuario      = datos.usuario   || nombreUsuario;
                        reserva.email        = datos.email;
                        reserva.fecha        = datos.fecha;
                        reserva.h_inicio     = datos.horaInicio;
                        reserva.h_fin        = datos.horaFin;
                        reserva.intervalo    = datos.intervalo;
                        reserva.lugar        = datos.espacio;
                        reserva.creadoPor    = datos.creadoPor || reserva.creadoPor;
                        reserva.fechaCreacion = r.created || null;
                    }

                    const resp = await reserva.cancelar();
                    if (resp.ok) {
                        mostrarToast('✅ Reserva cancelada', 'success');
                        try { await reserva.imprimirTicketCancelacion(); } catch(e) { console.error('Error ticket:', e); }
                        modal.remove();
                        cargarReservas(esAdmin ? combo.value : user.email);
                    } else {
                        const err = await resp.json();
                        mostrarToast('❌ Error: ' + (err.error || 'No se pudo cancelar'), 'error');
                        btnConfirmar.disabled = false;
                        btnConfirmar.innerText = 'Sí, Cancelar';
                    }
                } catch (err) {
                    mostrarToast('Error de conexión', 'error');
                    btnConfirmar.disabled = false;
                    btnConfirmar.innerText = 'Sí, Cancelar';
                }
            }
        );
    }

    // 4. Lógica de carga de datos
    const cargarReservas = async (emailFiltro) => {
        const resCont = document.getElementById('contenedor-resultados');
        resCont.innerHTML = '<p>Cargando datos...</p>';
        const hoy = new Date();
        const fechaInicio = hoy.toISOString().split('T')[0];
        const fechaFin = new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let url = `/.netlify/functions/informe_reservas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        if (emailFiltro) url += `&usuario=${encodeURIComponent(emailFiltro)}`;
        try {
            const resp = await fetch(url, {
                headers: getAuthHeaders()
            });
            const data = await resp.json();
            let reservas = Array.isArray(data) ? data : (data.reservas || []);
            reservas = reservas.filter(r => r.start && new Date(r.start) > new Date());
            renderReservasTable(reservas, resCont);
        } catch (err) {
            resCont.innerHTML = `<p style=\"color:red\">Error: ${err.message}</p>`;
        }
    };

    // Carga inicial
    cargarReservas(esAdmin ? "" : user.email);
}