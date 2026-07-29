import { APP_CONFIG, APP_VERSION } from './config.js';
import { getAuthHeaders } from './utils.js';

// Establecer el título del proyecto basado en config.js
if (APP_CONFIG && APP_CONFIG.nombreProyecto) {
    document.title = APP_CONFIG.nombreProyecto;
    
    // Si hay elementos con la clase "logo-text", actualizarlos
    const logoElements = document.querySelectorAll('.logo-text');
    logoElements.forEach(el => {
        el.textContent = APP_CONFIG.nombreProyecto;
    });
}

// Inyectar versión en UI
document.addEventListener('DOMContentLoaded', () => {
    const versionDisplays = document.querySelectorAll('.app-version-display');
    versionDisplays.forEach(el => {
        el.textContent = APP_VERSION || "v-.-.-";
    });
});

// Función para aplicar el fondo según el tema
function aplicarFondo() {
    const currentTheme = localStorage.getItem('espacia_theme') || 'classic';
    if (currentTheme === 'classic' && APP_CONFIG.estilos && APP_CONFIG.estilos.fondo) {
        document.body.style.background = APP_CONFIG.estilos.fondo;
    } else {
        document.body.style.background = ''; // Deja que el CSS del tema actúe
    }
    document.body.style.minHeight = '100vh';
}

// Aplicar fondo inicial
aplicarFondo();

// Escuchar cambios en el tema desde el selector
document.addEventListener('themeChanged', aplicarFondo);


// ================= ZONA DE SECCIONES =================

// --- Utilidad para limpiar CSS de sección ---
function limpiarCssSeccion() {
    const ids = ['agenda-v2-css', 'reservas-css', 'informe-css', 'abmusu2-css'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

// --- Sección Agenda V2 (Grilla) ---
function cargarEstiloAgendaV2() {
    limpiarCssSeccion();
    if (!document.getElementById('agenda-v2-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_agenda_v2.css';
        link.id = 'agenda-v2-css';
        document.head.appendChild(link);
    }
}

async function mostrarAgendaV2() {
    cargarEstiloAgendaV2();
    const sec = document.getElementById('agenda-v2-section');
    const cont = document.getElementById('agenda-v2-container');
    if (sec && cont) {
        sec.style.display = 'block';
        const { renderAgendaV2 } = await import('./agenda_v2.js');
        renderAgendaV2(cont);
    }
}

// --- Sección Reservas Futuras ---
function cargarEstiloReservas() {
    limpiarCssSeccion();
    if (!document.getElementById('reservas-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_reservas.css';
        link.id = 'reservas-css';
        document.head.appendChild(link);
    }
}

async function mostrarReservas() {
    cargarEstiloReservas();
    const sec = document.getElementById('reservas-section');
    const cont = document.getElementById('reservas-container');
    if (sec && cont) {
       sec.style.display = 'block';
        // Solo descarga reservas_futuras.js cuando se necesita
        const { renderMisReservasFuturas } = await import('./reservas_futuras.js');
        renderMisReservasFuturas(cont);    
    }
}

// --- Sección Informe ---
function cargarEstiloInforme() {
    limpiarCssSeccion();
    if (!document.getElementById('informe-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_informe.css';
        link.id = 'informe-css';
        document.head.appendChild(link);
    }
}

async function mostrarInforme() {
    cargarEstiloInforme();
    const sec = document.getElementById('informe-section');
    const cont = document.getElementById('informe-container');
    if (sec && cont) {
		sec.style.display = 'block';
        const { renderInforme } = await import('./informe_modular.js');
        renderInforme(cont);
    }
}

// --- Sección Informe Canceladas ---
async function mostrarInformeCanceladas() {
    cargarEstiloInforme(); // Reutilizamos el estilo del informe normal
    const sec = document.getElementById('informe-canceladas-section');
    const cont = document.getElementById('informe-canceladas-container');
    if (sec && cont) {
		sec.style.display = 'block';
        const { renderInformeCanceladas } = await import('./informe_canceladas.js');
        renderInformeCanceladas(cont);
    }
}

// --- Sección ABM USU ---



function cargarEstiloAbmUsu2() {
    limpiarCssSeccion();
    if (!document.getElementById('abmusu2-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_abmusu.css';
        link.id = 'abmusu2-css';
        document.head.appendChild(link);
    }
}

async function mostrarAbmUsu2() {
    cargarEstiloAbmUsu2();
    const sec = document.getElementById('abmusu2-section');
    const cont = document.getElementById('abmusu2-container');
    if (sec && cont) {
        sec.style.display = 'block';
        const { renderAbmUsu2 } = await import('./persistencia/abm_usuario.js');
        renderAbmUsu2(cont);
    }
}

// --- Controlador de Secciones ---
function mostrarSeccion(seccion) {
    // 1. IDs de las secciones definidos en dashboard.html
    const seccionesIds = [
        'agenda-v2-section',
        'reservas-section', 
        'informe-section',
        'admin-section',
        'abmusu2-section',
        'bloqueo-section',
        'cuponera-section'
    ];

    // 2. Ocultar todas las secciones para limpiar la pantalla
    seccionesIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Actualizar el título principal (quitar el "Cargando...")
    const welcome = document.getElementById('welcome-msg');
    if (welcome) {
        welcome.innerText = "Panel de Gestión";
    }

    // 4. Mostrar la sección correspondiente
    if (seccion === 'agenda-v2') mostrarAgendaV2();
    else if (seccion === 'mis-reservas-futuras') mostrarReservas();
    else if (seccion === 'informe') mostrarInforme();
    else if (seccion === 'abmusu2') mostrarAbmUsu2();
    else if (seccion === 'bloqueo') {
        const sec = document.getElementById('bloqueo-section');
        const cont = document.getElementById('bloqueo-container');
        if (sec && cont) {
            sec.style.display = 'block';
            const user = JSON.parse(localStorage.getItem('usuarioActual')) || JSON.parse(sessionStorage.getItem('usuarioActual'));
            import('./bloqueos.js').then(({ renderBloqueoHorarios }) => {
                renderBloqueoHorarios(cont, user);
            });
        }
    }
    else if (seccion === 'cuponera') {
        limpiarCssSeccion();
        const sec = document.getElementById('cuponera-section');
        const cont = document.getElementById('cuponera-container');
        if (sec && cont) {
            sec.style.display = 'block';
            import('./cuponeras.js').then(({ renderCuponera }) => {
                renderCuponera(cont);
            });
        }
    }
}

/**
 * Configuración inicial del Dashboard al cargar la página
 */
const initDashboard = async () => {
    // Verificar si el usuario está autenticado mediante localStorage/sessionStorage
    let user = null;
    try {
        const local = localStorage.getItem('usuarioActual');
        const session = sessionStorage.getItem('usuarioActual');

        user = local ? JSON.parse(local) : (session ? JSON.parse(session) : null);
    } catch (e) { }
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    // Mostrar el nombre del usuario en la barra de navegación
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.innerText = user.nombre || user.email;

    // Configurar los eventos de los botones del menú
    const btnAgendaV2 = document.getElementById('btn-agenda-v2');
    const btnReservas = document.getElementById('btn-reservas');
    const btnInforme = document.getElementById('btn-informe');
    const btnInformeCanceladas = document.getElementById('btn-informe-canceladas');
    const btnAbmUsu2 = document.getElementById('btn-abmusu2');
    const btnBloqueoHorarios = document.getElementById('btn-bloqueo-horarios');
    const btnCuponera = document.getElementById('btn-cuponera');
    const btnLogout = document.getElementById('logout-btn');

    if (btnReservas) {
        btnReservas.textContent = user?.rol === 'usuario' ? '🕰️ Mis Reservas' : '🕰️ Reservas';
        btnReservas.onclick = (e) => { activarBotonTab(e); mostrarSeccion('mis-reservas-futuras'); };
    }
    if (btnAgendaV2) btnAgendaV2.onclick = (e) => { activarBotonTab(e); mostrarSeccion('agenda-v2'); };
    if (btnInforme) btnInforme.onclick = (e) => { activarBotonTab(e); mostrarSeccion('informe'); };
    if (btnInformeCanceladas) btnInformeCanceladas.onclick = (e) => { activarBotonTab(e); mostrarSeccion('informe-canceladas'); };
    if (btnAbmUsu2) btnAbmUsu2.onclick = (e) => { activarBotonTab(e); mostrarSeccion('abmusu2'); };
    if (btnBloqueoHorarios) btnBloqueoHorarios.onclick = (e) => { activarBotonTab(e); mostrarSeccion('bloqueo'); };
    if (btnCuponera) btnCuponera.onclick = (e) => { activarBotonTab(e); mostrarSeccion('cuponera'); };

    // Helper para resaltar visualmente la pestaña activa
    function activarBotonTab(e) {
        document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
        if(e && e.target) e.target.classList.add('active');
    }

    if (btnLogout) {
        btnLogout.onclick = () => {
            localStorage.removeItem('usuarioActual');
            sessionStorage.removeItem('usuarioActual');
                localStorage.removeItem('consAge_token');
                sessionStorage.removeItem('consAge_token');
            window.location.href = 'index.html';
        };
    }

    // Por defecto, al entrar, mostramos la sección de Agenda V2
    mostrarSeccion('agenda-v2');

    // Mostrar u ocultar el botón ABM USU, Informe y Bloqueo Horarios solo para admin/gestor
    try {
        if (user && (user.rol === 'admin' || user.rol === 'gestor')) {
            if (btnInforme) btnInforme.style.display = '';
            if (btnInformeCanceladas) btnInformeCanceladas.style.display = '';
            if (btnAbmUsu2) btnAbmUsu2.style.display = '';
            if (btnBloqueoHorarios) btnBloqueoHorarios.style.display = '';
            if (btnBloqueoHorarios) {
                btnBloqueoHorarios.onclick = (e) => { activarBotonTab(e); mostrarSeccion('bloqueo'); };
            }
        } else {
            if (btnInforme) btnInforme.style.display = 'none';
            if (btnInformeCanceladas) btnInformeCanceladas.style.display = 'none';
            if (btnAbmUsu2) btnAbmUsu2.style.display = 'none';
            if (btnBloqueoHorarios) btnBloqueoHorarios.style.display = 'none';
        }
    } catch (e) {
        if (btnInforme) btnInforme.style.display = 'none';
        if (btnInformeCanceladas) btnInformeCanceladas.style.display = 'none';
        if (btnBloqueoHorarios) btnBloqueoHorarios.style.display = 'none';
    }
};


// Inicializar dashboard directamente con login local
initDashboard();
