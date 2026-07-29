import { APP_CONFIG } from './config.js';
import { getAuthHeaders, mostrarToast, mostrarModalConfirmacion, createComboUsuarios } from './utils.js';
import { initReservar } from './agenda/agenda_reservar.js';
import './agenda/agenda_detalle.js';


let currentDate = new Date();
let usuarioSeleccionadoAdmin = null;
let usuariosLista = [];
let esAdmin = false;
let user = null;

export async function renderAgendaV2(container) {
    try {
        user = JSON.parse(localStorage.getItem('usuarioActual')) || JSON.parse(sessionStorage.getItem('usuarioActual'));
        esAdmin = (user && (user.rol === 'admin' || user.rol === 'gestor'));

        if (esAdmin) {
            try {
                const resp = await fetch('/.netlify/functions/get-usuarios', {
                    headers: getAuthHeaders()
                });
                const js = await resp.json();
                if (Array.isArray(js)) {
                    let filtrados = js.filter(u => u.rol === 'usuario');
                    usuariosLista = filtrados.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
                }
            } catch (e) {
                console.error("Error cargando usuarios:", e);
            }
        }

        renderUI(container);
        await loadDataAndRenderGrid(container);

        // Inyectar estado compartido a los módulos de agenda
        initReservar({
            esAdmin,
            user,
            usuariosLista,
            get usuarioSeleccionadoAdmin() { return usuarioSeleccionadoAdmin; },
            recargarGrilla: () => loadDataAndRenderGrid(container)
        });

        // Auto-refresh cada 60 segundos para mantener la grilla actualizada
        // con reservas de otros usuarios — se cancela si el contenedor se desmonta
        if (window.__agendaRefreshInterval) clearInterval(window.__agendaRefreshInterval);
        window.__agendaRefreshInterval = setInterval(() => {
            if (document.contains(container)) {
                loadDataAndRenderGrid(container);
            } else {
                clearInterval(window.__agendaRefreshInterval);
            }
        }, 60000);

    } catch (error) {
        container.innerHTML = `<p style="color:red;">Error al cargar la interfaz: ${error.message}</p>`;
    }
}

function renderUI(container) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    let adminControls = '';
    let combo;
    if (esAdmin && usuariosLista.length > 0) {
        combo = createComboUsuarios(usuariosLista, {
            id: 'combo-usuario-reserva',
            name: 'usuario-reserva',
            clase: '',
            includeTodos: false,
            valueKey: 'email',
            textKey: 'nombre'
        });
        // Agregar opción 'Mí mismo' si corresponde
        if (!APP_CONFIG.comboAgendaSoloUsuarios) {
            const optMiMismo = document.createElement('option');
            optMiMismo.value = user.email;
            optMiMismo.textContent = `Mí mismo (${user.nombre || user.email})`;
            combo.insertBefore(optMiMismo, combo.firstChild);
        }
        // Agregar opción de placeholder
        const optPlaceholder = document.createElement('option');
        optPlaceholder.value = '';
        optPlaceholder.textContent = '-- Seleccione un usuario --';
        optPlaceholder.disabled = true;
        optPlaceholder.selected = true;
        combo.insertBefore(optPlaceholder, combo.firstChild);
        combo.style.padding = '6px';
        combo.style.borderRadius = '4px';
        combo.style.border = '1px solid var(--border)';
        combo.style.background = 'var(--white)';
        combo.style.color = 'var(--text-main)';
        combo.style.fontSize = '0.9rem';
        adminControls = `<div style="display: flex; align-items: center; gap: 10px; color: var(--text-main);">
            <label for='combo-usuario-reserva' style='font-weight:600; font-size: 0.9rem;'>Agendando para:</label>
        </div>`;
    }

    container.innerHTML = `
        <div class="agenda-v2-container">
            <div class="agenda-v2-header" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px;">
                <h2 class="module-title">Agenda</h2>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: bold; font-size: 1.1rem; color: var(--text-main);" id="display-date"></span>
                        <input type="date" id="date-picker" class="agenda-v2-date-picker" value="${dateStr}" style="padding: 6px 10px;">
                    </div>
                </div>
                <div id="combo-usuario-reserva-container"></div>
            </div>
            <div id="grid-container" class="agenda-v2-grid-wrapper" style="margin-top: 15px;">
                <div style="padding: 40px; text-align: center; color: #666;">Cargando disponibilidad...</div>
            </div>
        </div>
    `;
    // Insertar el combo generado
    if (esAdmin && usuariosLista.length > 0) {
        const comboContainer = container.querySelector('#combo-usuario-reserva-container');
        comboContainer.innerHTML = adminControls;
        comboContainer.appendChild(combo);
    }

    updateDateDisplay(container);
    attachEventListeners(container);
}

function updateDateDisplay(container) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const displayStr = currentDate.toLocaleDateString('es-UY', options);
    container.querySelector('#display-date').textContent = displayStr.charAt(0).toUpperCase() + displayStr.slice(1);
    
    // Ajustar la fecha para el input type="date" considerando la zona horaria local
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    container.querySelector('#date-picker').value = `${year}-${month}-${day}`;
}

function attachEventListeners(container) {

    container.querySelector('#date-picker').addEventListener('change', (e) => {
        if (e.target.value) {
            // Fix timezone offset issue when parsing date string
            const [year, month, day] = e.target.value.split('-');
            currentDate = new Date(year, month - 1, day);
            updateDateDisplay(container);
            loadDataAndRenderGrid(container);
        }
    });

    const combo = container.querySelector('#combo-usuario-reserva');
    if (combo) {
        combo.addEventListener('change', (e) => {
            usuarioSeleccionadoAdmin = e.target.value;
        });
        usuarioSeleccionadoAdmin = combo.value;
    }
}

async function loadDataAndRenderGrid(container) {
    const gridContainer = container.querySelector('#grid-container');
    gridContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">⌛ Consultando disponibilidad en tiempo real...</div>';

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // Determinar espacios a mostrar (Marca Blanca)
    let consultoriosAMostrar = [];
    if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
        consultoriosAMostrar = APP_CONFIG.espacios.items
            .filter(item => item.id !== "0") // Excluir "Todos" p.ej. si existiera
            .map(item => parseInt(item.id))
            .filter(num => {
                if (num === 1) return esAdmin;
                return true;
            });
    } else {
        // Fallback temporal legacy
        consultoriosAMostrar = (APP_CONFIG.consultorios || []).filter(num => {
            if (num === 0) return false;
            if (num === 1) return esAdmin;
            return true;
        });
    }

    // Filtrar consultorios por consPref para roles usuarios
    if (user.rol === 'usuario' && Array.isArray(user.consPref) && user.consPref.length > 0) {
        consultoriosAMostrar = consultoriosAMostrar.filter(num => user.consPref.includes(num));
    }

    try {
        // Fetch data for ALL espacios para esta fecha
        // Enviamos el prefijo Gcal para que el backend lo sepa
        const prefix = APP_CONFIG.espacios?.prefijoGeneral || 'C';
        const url = `/.netlify/functions/informe_reservas?fechaInicio=${dateStr}&fechaFin=${dateStr}&prefijoGcal=${prefix}`;
        const resp = await fetch(url, {
            headers: getAuthHeaders()
        });
        if (!resp.ok) throw new Error(`Error de red: ${resp.status}`);
        const data = await resp.json();
        const reservas = data.reservas || [];

        renderGrid(gridContainer, consultoriosAMostrar, reservas, dateStr);

    } catch (error) {
        console.error("Error loading grid data:", error);
        gridContainer.innerHTML = `<div style="padding: 20px; color: red; text-align: center;">Error al cargar datos: ${error.message}</div>`;
    }
}

function renderGrid(gridContainer, consultorios, reservas, dateStr) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday...
    
    // Validar que sea un día laboral según config.js
    if (APP_CONFIG.diasLaborales && !APP_CONFIG.diasLaborales.includes(dayOfWeek)) {
        // En lugar de renderizar la grilla, mostramos un mensaje
        gridContainer.innerHTML = `
            <div style="padding: 50px 20px; text-align: center; color: var(--text-muted, #666); background: var(--bg-zebra, #f8f9fa); border-radius: var(--radius, 8px); border: 1px solid var(--border, #eee);">
                <span style="font-size: 3rem; display: block; margin-bottom: 10px;">🌴</span>
                <h3 style="color: var(--primary, #2c3e50); margin-bottom: 10px;">Día cerrado</h3>
                <p style="font-size: 1.1rem;">La agenda no permite reservas los <strong>${currentDate.toLocaleDateString('es-UY', {weekday: 'long'})}s</strong> porque no es un día laboral.</p>
            </div>
        `;
        return;
    }

    // Get hours config
    let startHour = APP_CONFIG.horarios.inicio;
    let endHour = APP_CONFIG.horarios.fin;
    
    if (APP_CONFIG.horariosEspeciales && APP_CONFIG.horariosEspeciales[dayOfWeek]) {
        startHour = APP_CONFIG.horariosEspeciales[dayOfWeek].inicio;
        endHour = APP_CONFIG.horariosEspeciales[dayOfWeek].fin;
    }

    // Create grid layout
    // 1 column for time + 1 column per consultorio
    // Usamos 1fr para que los consultorios ocupen todo el ancho disponible equitativamente
    const gridTemplateColumns = `60px repeat(${consultorios.length}, minmax(110px, 1fr))`;
    
    let html = '';

    // MENU DE PESTAÑAS (SOLO VISIBLE EN MOVILES)
    html += `<div class="agenda-mobile-tabs hide-on-desktop">`;
    const labelGeneral = APP_CONFIG.espacios?.etiquetaGeneral || 'Cons';
    
    consultorios.forEach((cons, idx) => {
        // Encontrar el nombre corto si existe
        let nombreOpcion = `${labelGeneral} ${cons}`;
        if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
            const espacioItem = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === cons);
            if (espacioItem && espacioItem.nombreCorto) nombreOpcion = espacioItem.nombreCorto;
        }
        
        html += `<button class="mobile-tab-btn ${idx === 0 ? 'active' : ''}" data-target-cons="${cons}">${nombreOpcion}</button>`;
    });
    html += `</div>`;
    
    // Contenedor de grilla con el estado inicial del primer consultorio para la vista móvil
    html += `<div class="agenda-v2-grid" data-active-mobile-cons="${consultorios[0]}" style="grid-template-columns: ${gridTemplateColumns};">`;

    // Header Row
    html += `<div class="grid-header-cell" style="grid-column: 1; grid-row: 1; font-size: 0.8rem; padding: 10px 2px;">Hora</div>`;
    consultorios.forEach((cons, index) => {
        let nombreColumna = `${labelGeneral} ${cons}`;
        if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
            const espacioItem = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === cons);
            if (espacioItem && espacioItem.nombreCorto) nombreColumna = espacioItem.nombreCorto;
        }
        html += `<div class="grid-header-cell" data-cons="${cons}" style="grid-column: ${index + 2}; grid-row: 1; font-size: 0.85rem; padding: 10px 2px;">${nombreColumna}</div>`;
    });

    // Time Rows (30-minute intervals)
    let row = 2;
    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 30) {
            const timeLabel = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            const isHalfHour = m === 30;
            const textStyle = isHalfHour ? 'color: #888;' : '';
            
            html += `<div class="grid-time-cell ${isHalfHour ? 'half-hour' : ''}" style="grid-column: 1; grid-row: ${row}; font-size: 0.75rem; padding: 2px; ${textStyle}">${timeLabel}</div>`;
            
            consultorios.forEach((cons, index) => {
                const col = index + 2;
                html += `
                    <div class="grid-slot ${isHalfHour ? 'half-hour' : ''}" 
                         data-cons="${cons}" 
                         data-time="${timeLabel}" 
                         data-date="${dateStr}"
                         style="grid-column: ${col}; grid-row: ${row};">
                        <button class="slot-action-btn" onclick="window.iniciarReservaV2(${cons}, '${dateStr}', '${timeLabel}')">+</button>
                    </div>
                `;
            });
            row++;
        }
    }

    html += `</div>`;
    gridContainer.innerHTML = html;

    // Place bookings
    placeBookings(gridContainer, reservas, consultorios, startHour, endHour);

    // Time Indicator — Línea de tiempo actual SOLO si es el día de hoy
    const gridEl = gridContainer.querySelector('.agenda-v2-grid');
    if (gridEl) {
        // Comparar dateStr (agenda) con hoy
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        if (dateStr === hoyStr) {
            window.initTimeIndicator(gridEl, 50); // 50px por slot de 30min
        }
    }

    // Eventos para Pestañas Móviles
    const mobileTabs = gridContainer.querySelectorAll('.mobile-tab-btn');
    mobileTabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            mobileTabs.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const target = e.target.getAttribute('data-target-cons');
            gridEl.setAttribute('data-active-mobile-cons', target);
        });
    });
}

function placeBookings(gridContainer, reservas, consultorios, startHour, endHour) {
    const grid = gridContainer.querySelector('.agenda-v2-grid');
    if (!grid) return;

    reservas.forEach(res => {
        if (res.summary && res.summary.toLowerCase().includes('cancelada')) return;
        
        const prefix = APP_CONFIG.espacios?.prefijoGeneral || 'C';

        // Parse consultorio from summary (e.g., "C3: Reserva..." o "C5: Bloqueada-Limpieza")
        let consMatch = res.summary ? res.summary.match(new RegExp(`${prefix}(\\d+):`, 'i')) : null;
        let consNum = consMatch ? parseInt(consMatch[1]) : null;

        // fallback: a veces el texto viene de otro origen, e.g. "Consultorio: 4"
        if (!consNum && res.description) {
            const descMatch = res.description.match(/consultorio\s*[:\-]?\s*(\\d+)/i);
            if (descMatch) consNum = parseInt(descMatch[1]);
        }
        if (!consNum && res.location) {
            const locMatch = res.location.match(/(\\d+)/);
            if (locMatch) consNum = parseInt(locMatch[1]);
        }

        // Handle global blocks (C0)
        const isGlobalBlock = res.summary && res.summary.toUpperCase().startsWith(`${prefix.toUpperCase()}0: BLOQUEADA`);

        // Parse start time
        // We will use the exact same logic as the original agenda.js to ensure consistency
        // En agenda.js se usa new Date(res.start) y new Date(res.end)
        // Pero la API devuelve res.start.dateTime o res.start.date
        const startDateStr = res.start;
        const endDateStr = res.end;
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        const isFullDay = !startDateStr || startDateStr.length <= 10; // Si es solo fecha (YYYY-MM-DD)
        
        let startH = startDate.getHours();
        let startM = startDate.getMinutes();
        let endH = endDate.getHours();
        let endM = endDate.getMinutes();

        if (isFullDay) {
            startH = startHour;
            startM = 0;
            endH = endHour;
            endM = 0;
        }

        // Adjust if event starts before visible hours but ends within or after
        if (startH < startHour) {
            if (endH < startHour || (endH === startHour && endM === 0)) return; // Completely before visible hours
            startH = startHour;
            startM = 0;
        }

        // Adjust if event ends after visible hours
        if (endH > endHour || (endH === endHour && endM > 0)) {
            if (startH >= endHour) return; // Completely after visible hours
            endH = endHour;
            endM = 0;
        }

        // Calculate duration in hours (e.g., 1.5 for 90 mins)
        const durationHours = (endH + endM/60) - (startH + startM/60);

        // Only process if within visible hours (should be handled by above checks, but just in case)
        if (startH >= endHour || endH <= startHour || durationHours <= 0) return;

        // Determine booking type and visibility
        let typeClass = 'ajena';
        let title = 'Ocupado';
        let isOwn = false;

        if (isGlobalBlock) {
            typeClass = 'bloqueo';
            title = 'BLOQUEADO';
        }

        // Check if it's own booking
        const userEmail = user ? user.email.toLowerCase() : '';
        const desc = (res.description || '').toLowerCase();
        
        if (!isGlobalBlock && (esAdmin || desc.includes(userEmail))) {
            isOwn = true;
            // Extract name from summary (e.g. "C5: Juan Perez" -> "Juan Perez")
            let nameMatch = res.summary ? res.summary.match(new RegExp(`^${prefix}\\d+:\\s*(.+)$`, 'i')) : null;
            title = nameMatch ? nameMatch[1].trim() : 'Reserva';
            
            if (res.summary.toLowerCase().includes('fija')) {
                typeClass = 'fija';
            } else {
                typeClass = 'eventual';
            }
        }

        if (isGlobalBlock) {
            typeClass = 'bloqueo';
            title = 'BLOQUEADO';
            isOwn = esAdmin; // Only admins see details of blocks
        }

        // Function to place block in a specific column
        const placeBlock = (cNum) => {
            const colIndex = consultorios.indexOf(cNum);
            if (colIndex === -1) return; // Consultorio not visible

            const col = colIndex + 2;
            
            // Calculate exact row position (each hour has 2 rows now)
            const startRowOffset = (startH - startHour) * 2 + (startM >= 30 ? 1 : 0);
            const rowStart = startRowOffset + 2;
            
            // Calculate row span (each row is 30 mins = 0.5 hours)
            // durationHours = 1.5 -> spans 3 rows
            // We use Math.round to avoid floating point precision issues (e.g. 1.5 * 2 = 3.0000000000000004)
            const rowSpan = Math.max(1, Math.round(durationHours * 2));
            
            // Find the slots to mark them as having a booking
            for (let i = 0; i < rowSpan; i++) {
                const slotH = startHour + Math.floor((startRowOffset + i) / 2);
                const slotM = ((startRowOffset + i) % 2) === 0 ? 0 : 30;
                if (slotH >= endHour) break;
                
                const timeLabel = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`;
                const slot = grid.querySelector(`.grid-slot[data-cons="${cNum}"][data-time="${timeLabel}"]`);
                if (slot) {
                    slot.classList.add('has-booking');
                    // Remove the agendar button
                    const btn = slot.querySelector('.slot-action-btn');
                    if (btn) btn.remove();
                }
            }

            // Create the block element
            const block = document.createElement('div');
            block.className = `booking-block ${typeClass}`;
            block.setAttribute('data-cons', cNum); // Agregamos el identificador para la vista móvil
            block.style.gridColumn = col;
            block.style.gridRow = `${rowStart} / span ${rowSpan}`;
            block.style.position = 'relative';
            block.style.marginTop = '1px';
            block.style.height = 'calc(100% - 2px)';
            block.style.width = 'calc(100% - 4px)';
            block.style.marginLeft = '2px';
            block.style.zIndex = '10';

            // Si la flag está activada, aplicamos el color correspondiente al espacio actual
            if (APP_CONFIG.espacios?.usarColoresEnAgenda !== false) {
                let colorIdGoogle = null;
                if (APP_CONFIG.espacios && APP_CONFIG.espacios.items) {
                    const item = APP_CONFIG.espacios.items.find(i => parseInt(i.id) === cNum);
                    if (item) colorIdGoogle = item.colorGoogle;
                } else if (APP_CONFIG.coloresConsultorios) {
                    colorIdGoogle = APP_CONFIG.coloresConsultorios[cNum];
                }
                if (colorIdGoogle && APP_CONFIG.paletaColoresGoogle[colorIdGoogle]) {
                    const esModoAstigmatismo = document.body.classList.contains('theme-astigmatismo');
                    if (esModoAstigmatismo) {
                        block.style.backgroundColor = APP_CONFIG.paletaColoresGoogle[colorIdGoogle];
                        block.style.backgroundColor = `color-mix(in srgb, ${APP_CONFIG.paletaColoresGoogle[colorIdGoogle]} 20%, #2A2A35 80%)`;
                        block.style.color = '#D9D9E3';
                        block.style.border = `1px solid ${APP_CONFIG.paletaColoresGoogle[colorIdGoogle]}`;
                        block.style.borderLeft = `4px solid ${APP_CONFIG.paletaColoresGoogle[colorIdGoogle]}`;
                    } else {
                        block.style.backgroundColor = APP_CONFIG.paletaColoresGoogle[colorIdGoogle];
                        block.style.color = '#333';
                        block.style.border = '1px solid rgba(0,0,0,0.1)';
                    }
                }
            }

            block.style.boxSizing = 'border-box';
            block.style.minHeight = '20px';

            // Visual pastel si la reserva ya inició
            const ahora = new Date();
            const inicioReserva = new Date(res.start);
            if (ahora > inicioReserva) {
                block.classList.add('past');
                // Guardar el color original en CSS variable para el mix
                block.style.setProperty('--booking-bg', block.style.backgroundColor);
            }

            const timeDisplay = isFullDay ? 'Todo el día' : `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
            block.innerHTML = `
                <div class="booking-title">${isOwn ? title : 'Ocupado'}</div>
                <div class="booking-time">${timeDisplay}</div>
            `;
            if (isOwn) {
                block.title = res.description || res.summary;
                block.onclick = () => window.mostrarDetalleReserva(res.id, res.summary, res.description || '', res.created || null, () => loadDataAndRenderGrid(gridContainer.closest('.agenda-v2-container')?.parentElement || document.querySelector('.agenda-v2-container').parentElement));
            }
            grid.appendChild(block);
        };

        if (isGlobalBlock) {
            // Place in all visible consultorios
            consultorios.forEach(c => placeBlock(c));
        } else if (consNum !== null) {
            placeBlock(consNum);
        }
    });
}