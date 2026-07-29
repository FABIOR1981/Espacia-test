// js/informe_modular.js
// Versión Final Unificada - ESPACIA con Filtro de Estado Dinámico y Estadísticas Completas

import { APP_CONFIG } from './config.js';
import { getAuthHeaders, mostrarToast, createComboUsuarios, getCanceladoPor } from './utils.js';

let __datosActualesInforme = { reservas: [], totales: {} };

export async function renderInforme(container) {
    const etiquetaGlobal = APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio';
    const nombreEmpresa = APP_CONFIG.nombreProyecto || '';
    
    container.innerHTML = `
    <div class="informe-container">
        <div style="margin-bottom: 20px; border-left: 5px solid var(--primary, #d35400); padding-left: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 class="module-title" style="margin:0;">ESPACIA <span style="font-weight:300; color:#666;">| ${nombreEmpresa}</span></h2>
                <small style="color:#888;">Informe detallado de reservas y consumos</small>
            </div>
            <button id="btn-exportar-pdf" class="btn-menu" style="display:none; background: #2c3e50; color: white; border: none; cursor: pointer; padding: 10px 15px; border-radius: 6px; font-weight: bold;">
                <i class="fas fa-file-pdf"></i> Descargar PDF
            </button>
        </div>
        
        <form id="form-informe" class="informe-form" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="color: #d35400; font-weight: 600; margin: 0;">Inicio:</label>
                <input type="date" name="fechaInicio" required style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; max-width: 115px;">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="color: #d35400; font-weight: 600; margin: 0;">Fin:</label>
                <input type="date" name="fechaFin" required style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; max-width: 115px;">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="color: #d35400; font-weight: 600; margin: 0;">${etiquetaGlobal}:</label>
                <select name="consultorio" id="combo-consultorio" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; max-width: 110px;">
                    <option value="">Todos</option>
                </select>
            </div>
            <div id="search-row-informe" style="display: flex; align-items: center; gap: 5px;"></div>
            
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="color: #d35400; font-weight: 600; margin: 0;">Estado:</label>
                <select name="estado" id="combo-estado-informe" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; max-width: 120px;">
                    <option value="">Todos</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="CONSUMIDA">Consumida</option>
                    <option value="CANCELADA">Cancelada</option>
                </select>
            </div>

            <div style="display: flex; align-items: center; gap: 5px; margin-left: 10px;">
                <input type="checkbox" id="chk-agrupar-espacio" name="agruparEspacio" style="accent-color: #d35400; width: 18px; height: 18px;">
                <label for="chk-agrupar-espacio" style="color: #d35400; font-weight: 600; margin: 0; cursor:pointer;">Agrupar</label>
            </div>
            <button type="submit" style="background: var(--primary, #d35400); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">Buscar</button>
        </form>
        <div id="total-horas-informe"></div>
        <div id="contenedor-resultados"><p>Complete los filtros y presione Buscar</p></div>
    </div>`;

    await renderComboUsuariosInforme(container);
    initInforme(container);
}

async function renderComboUsuariosInforme(container) {
    let usuariosLista = [];
    try {
        const resp = await fetch('/.netlify/functions/get-usuarios', { headers: getAuthHeaders() });
        const js = await resp.json();
        if (Array.isArray(js)) {
            usuariosLista = js.filter(u => u.rol === 'usuario').sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
    } catch (e) { console.error(e); }
    const searchRow = container.querySelector('#search-row-informe');
    searchRow.innerHTML = `<label style="color: #d35400; font-weight: 600; margin: 0;">Usuario:</label>`;
    const combo = createComboUsuarios(usuariosLista, {
        id: 'combo-usuario-informe',
        name: 'busqueda',
        clase: '',
        includeTodos: true,
        valueKey: 'email',
        textKey: 'nombre'
    });
    combo.style.padding = '6px';
    combo.style.border = '1px solid #ccc';
    combo.style.borderRadius = '4px';
    combo.style.maxWidth = '160px';
    searchRow.appendChild(combo);
}

export async function initInforme(container) {
    const form = container.querySelector('#form-informe');
    const resultContainer = container.querySelector('#contenedor-resultados');
    const btnExportar = container.querySelector('#btn-exportar-pdf');
    const totalHorasDiv = container.querySelector('#total-horas-informe');
    const comboConsultorio = container.querySelector('#combo-consultorio');

    if (APP_CONFIG.espacios?.items) {
        APP_CONFIG.espacios.items.forEach(c => {
            if (c.id === "0") return;
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombreCorto || `Espacio ${c.id}`;
            comboConsultorio.appendChild(opt);
        });
    }

  btnExportar.onclick = async () => {
    if (!__datosActualesInforme.reservas || __datosActualesInforme.reservas.length === 0) return;
    
    mostrarToast("Generando reporte...", "info");
    
    try {
        const form = container.querySelector('#form-informe');
        
        // Preparamos el objeto de filtros exactamente como lo espera el nuevo pdf_reporte.js
        const filtros = {
            reservas: __datosActualesInforme.reservas,
            totales: __datosActualesInforme.totales,
            fechaInicio: form.elements['fechaInicio'].value,
            fechaFin: form.elements['fechaFin'].value,
            estado: form.elements['estado'].value,
            usuario: form.elements['busqueda']?.value || "",
            espacio: form.elements['consultorio'].value
        };

        // Importación dinámica del nuevo archivo unificado
        const moduloPDF = await import('./pdf/pdf_reporte.js');
        
        // Llamada a la función exportada
        await moduloPDF.generarPDFInforme(filtros);

    } catch (err) {
        console.error("Error al exportar PDF:", err);
        mostrarToast("Error al crear el PDF", "error");
    }
};

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resultContainer.innerHTML = '<p>Cargando informe...</p>';
        btnExportar.style.display = 'none';

        const fIni = form.elements['fechaInicio'].value;
        const fFin = form.elements['fechaFin'].value;
        const cons = form.elements['consultorio'].value;
        const user = form.elements['busqueda']?.value || '';
        const estadoFiltro = form.elements['estado'].value;
        const prefix = APP_CONFIG.espacios?.prefijoGeneral || 'C';

        let url = `/.netlify/functions/informe_reservas?fechaInicio=${fIni}&fechaFin=${fFin}&prefijoGcal=${prefix}`;
        if (cons) url += `&consultorio=${cons}`;
        if (user) url += `&usuario=${user}`;

        try {
            const resp = await fetch(url, { headers: getAuthHeaders() });
            const data = await resp.json();
            let lista = Array.isArray(data) ? data : (data?.reservas || []);

            if (estadoFiltro) {
                lista = lista.filter(r => {
                    const isC = r.summary?.toLowerCase().includes('cancelada');
                    const isPast = new Date(r.start) < new Date();
                    const est = isC ? 'CANCELADA' : (isPast ? 'CONSUMIDA' : 'PENDIENTE');
                    return est === estadoFiltro;
                });
            }

            if (lista.length === 0) {
                resultContainer.innerHTML = '<p>No se encontraron reservas.</p>';
                totalHorasDiv.innerText = '';
                return;
            }

            btnExportar.style.display = 'block';
            renderReservasTable(lista, resultContainer, totalHorasDiv, false);
        } catch (err) {
            resultContainer.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        }
    });
}

function renderReservasTable(reservas, containerDestino, totalHorasDiv, esVistaFuturas) {
    const pageSize = APP_CONFIG.pageSize || 20;
    let currentPage = 1;
    const totalPages = Math.ceil(reservas.length / pageSize) || 1;
    
    const horasMinutos = (val) => {
        const h = Math.floor(val);
        const m = Math.round((val - h) * 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    function calcularYGuardarTotales() {
        const intervalos = APP_CONFIG.horarios?.intervalos || [60, 90];
        const initS = () => ({ horas: 0, count: 0, desglose: intervalos.reduce((a, m) => ({...a, [m]: 0}), {}) });
        const stats = { pendientes: initS(), consumidas: initS(), canceladas: initS(), total: initS() };

        function resolveEspacioLabelFromRaw(r) {
            const pref = APP_CONFIG.espacios?.prefijoGeneral || '';
            const items = APP_CONFIG.espacios?.items || [];
            const summaryRaw = (r.summary || '').toString();
            // Buscar patrón tipo C5 o C-5 o C 5
            const re = new RegExp(pref + '\\s*-?\\s*(\\d+)', 'i');
            const mPref = summaryRaw.match(re);
            if (mPref) {
                const num = mPref[1];
                const found = items.find(it => it.id === String(num) || (it.prefijoGcal || '').toLowerCase() === (pref + num).toLowerCase());
                if (found) return found.nombreCorto || `${APP_CONFIG.espacios.etiquetaGeneral} ${num}`;
                return `${APP_CONFIG.espacios.etiquetaGeneral} ${num}`;
            }
            // Si no está el prefijo, intentar tomar la primera parte antes de ':'
            const first = summaryRaw.split(':')[0]?.trim();
            if (first) return first;
            return 'N/A';
        }

        const mapped = reservas.map(r => {
            const dI = new Date(r.start);
            const dF = new Date(r.end);
            const dH = (dF - dI) / 3600000;
            const dM = Math.round((dF - dI) / 60000);
            const isC = r.summary?.toLowerCase().includes('cancelada');
            const isP = dI < new Date();

            const duenioReserva = r.summary?.split(':')[1]?.trim() || '';
            const accionRealizada = getCanceladoPor(r) || "---";
            const espacioLabel = resolveEspacioLabelFromRaw(r);

            // Categorizar por estado real: cancelada, consumida (pasada no cancelada), pendiente (futura)
            if (isC) {
                stats.canceladas.horas += dH;
                stats.canceladas.count++;
                if (intervalos.includes(dM)) stats.canceladas.desglose[dM]++;
            } else if (dI < new Date()) {
                stats.consumidas.horas += dH;
                stats.consumidas.count++;
                if (intervalos.includes(dM)) stats.consumidas.desglose[dM]++;
            } else {
                stats.pendientes.horas += dH;
                stats.pendientes.count++;
                if (intervalos.includes(dM)) stats.pendientes.desglose[dM]++;
            }

            // Acumular en total crudo de reservas (como viene de Google Calendar)
            stats.total.horas += dH;
            stats.total.count++;
            if (intervalos.includes(dM)) stats.total.desglose[dM]++;

                return {
                fecha: dI.toLocaleDateString('es-ES'),
                inicio: dI.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}),
                duracion: `${dM} min`,
                usuario: duenioReserva,
                espacio: espacioLabel,
                    estado: isC ? 'CANCELADA' : (dI < new Date() ? 'CONSUMIDA' : 'PENDIENTE'),
                canceladoPor: accionRealizada 
            };
        });

        __datosActualesInforme = {
            reservas: mapped,
            totales: {
                reservadas: { ...stats.total, horas: horasMinutos(stats.total.horas) },
                pendientes: { ...stats.pendientes, horas: horasMinutos(stats.pendientes.horas) },
                consumidas: { ...stats.consumidas, horas: horasMinutos(stats.consumidas.horas) },
                canceladas: { ...stats.canceladas, horas: horasMinutos(stats.canceladas.horas) }
            }
        };
        return stats;
    }

    function renderPage(page) {
        let html = `<div class="table-main-container"><table class="custom-table"><thead><tr><th>#</th><th>Fecha</th><th>Inic.</th><th>Durac.</th><th>Espacio</th><th>Usuario</th><th>Estado</th></tr></thead><tbody>`;
        const start = (page - 1) * pageSize;
        const end = Math.min(start + pageSize, reservas.length);

            for (let idx = start; idx < end; idx++) {
            const r = reservas[idx];
            const dI = new Date(r.start);
            const dM = Math.round((new Date(r.end) - dI) / 60000);
            const isC = r.summary?.toLowerCase().includes('cancelada');
                const isPast = dI < new Date();
            html += `<tr><td>${idx+1}</td><td>${dI.toLocaleDateString('es-ES')}</td><td>${dI.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'})}</td><td>${dM} min</td><td>${r.summary?.split(':')[0] || ''}</td><td>${r.summary?.split(':')[1] || ''}</td><td><span class="status-badge ${isC?'cancelada':isPast?'consumida':'pendiente'}">${isC?'CANCELADA':isPast?'CONSUMIDA':'PENDIENTE'}</span></td></tr>`;
        }
        html += `</tbody></table></div><div class="pagination" style="margin-top:10px; display:flex; gap:10px; align-items:center;"><button id="btn-prev" ${page===1?'disabled':''}>Ant.</button><span>${page} / ${totalPages}</span><button id="btn-next" ${page===totalPages?'disabled':''}>Sig.</button></div>`;
        containerDestino.innerHTML = html;

        containerDestino.querySelector('#btn-prev').onclick = () => { if(currentPage > 1) { currentPage--; renderPage(currentPage); } };
        containerDestino.querySelector('#btn-next').onclick = () => { if(currentPage < totalPages) { currentPage++; renderPage(currentPage); } };

        if (!esVistaFuturas && totalHorasDiv) {
            const st = calcularYGuardarTotales();
            const dg = (o) => Object.entries(o).map(([m, c]) => `${m}m: ${c}`).join(' | ');
            totalHorasDiv.innerHTML = `
            <div class="scorecard-grid">
                <div class="card-stat amber">
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;margin-bottom:8px;">
                        <div class="card-stat-title">Reservadas</div>
                    </div>
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;gap:16px;">
                        <div class="card-stat-time">${horasMinutos(st.total.horas)}</div>
                        <div class="card-stat-desglose">${dg(st.total.desglose)}</div>
                    </div>
                </div>
                <div class="card-stat">
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;margin-bottom:8px;">
                        <div class="card-stat-title">Pendientes</div>
                    </div>
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;gap:16px;">
                        <div class="card-stat-time">${horasMinutos(st.pendientes.horas)}</div>
                        <div class="card-stat-desglose">${dg(st.pendientes.desglose)}</div>
                    </div>
                </div>
                <div class="card-stat green">
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;margin-bottom:8px;">
                        <div class="card-stat-title">Consumidas</div>
                    </div>
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;gap:16px;">
                        <div class="card-stat-time">${horasMinutos(st.consumidas.horas)}</div>
                        <div class="card-stat-desglose">${dg(st.consumidas.desglose)}</div>
                    </div>
                </div>
                <div class="card-stat red">
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;margin-bottom:8px;">
                        <div class="card-stat-title">Canceladas</div>
                    </div>
                    <div style="width:100%;display:flex;justify-content:center;align-items:center;gap:16px;">
                        <div class="card-stat-time">${horasMinutos(st.canceladas.horas)}</div>
                        <div class="card-stat-desglose">${dg(st.canceladas.desglose)}</div>
                    </div>
                </div>
            </div>`;
        }
    }
    renderPage(currentPage);
}