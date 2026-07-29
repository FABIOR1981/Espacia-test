// js/config.js

export const TIPOS_CUPONERA = ['10', '20'];

// ==============================================================================
// 1. CONFIGURACIÓN DEL CLIENTE (MARCA BLANCA)
// ==============================================================================
//por deployar alguna cosa
// Estas son las únicas variables que debes modificar al clonar el sistema para un cliente nuevo.

// ATENCIÓN: Al cambiar esta versión, hazlo también en sw.js (CACHE_NAME) para forzar la actualización en los móviles de los clientes.
export const APP_VERSION = '4.9.15';
// Controla si se muestra el modal de aviso de cambio de versión
export const SHOW_UPDATE_MODAL = true;

// A. Identidad de la Empresa
export const EMPRESA_NOMBRE = "De Maria Consultorios";
export const EMPRESA_TELEFONO = "091001334"; // Aparece en los PDFs y contactos
export const EMPRESA_EMAIL ="demariaconsultorios1334@gmail.com"; // Para contacto en PDFs y formularios
export const EMPRESA_LOGO = "imagenes/logo_demaria.png"; // Aparece en los PDFs y contactos

// B. Entidad a Alquilar/Reservar (Ej: "Consultorio - C", "Box - B", "Mesa - M")
const ESPACIOS_CANTIDAD = 5; 
export const ESPACIOS_ETIQUETA = "Consultorio"; 
export const ESPACIOS_ETIQUETA_PLURAL = ESPACIOS_ETIQUETA + "s"; // Para textos como "No hay Consultorios disponibles"
export const ESPACIOS_PREFIJO = "C";           

// C. Configuración de Usuarios por defecto
export const USUARIO_DOMINIO_EMAIL = "@espacia.com.uy";

// D. Reglas de Negocio y Horarios
const REGLA_DIAS_LABORALES = [1, 2, 3, 4, 5, 6]; // 0=Dom, 1=Lun... 6=Sáb
const REGLA_HORA_INICIO = 8; // 08:00
const REGLA_HORA_FIN = 22;   // 22:00
const REGLA_INTERVALOS_MINUTOS = [60, 90]; // Duraciones permitidas en el combo

// D. Restricciones de Cancelación
const REGLA_HORAS_CANCELACION = 24; // Cuántas horas antes puede cancelar un usuario normal
const REGLA_FIN_DE_SEMANA = false;  // Si es true, el Lunes cuenta como 72hs de anticipación
const REGLA_MAX_SEMANAS_FUTURO = 12; // Cuántas semanas hacia adelante puede agendar un usuario

// E. Estética
const ESTILO_FONDO_CSS = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)'; // Degradado verde suave


// ==============================================================================
// 2. NÚCLEO DEL SISTEMA (NO MODIFICAR - SE AUTOGENERA)
// ==============================================================================
const coloresGoogle = ["6", "5", "3", "7", "10", "2", "11", "9", "4", "1"];
const itemsGenerados = [
    { id: "0", nombreCorto: "Todos", prefijoGcal: `${ESPACIOS_PREFIJO}0`, colorGoogle: "11" }
];
for (let i = 1; i <= ESPACIOS_CANTIDAD; i++) {
    itemsGenerados.push({
        id: String(i),
        nombreCorto: `${ESPACIOS_ETIQUETA} ${i}`,
        prefijoGcal: `${ESPACIOS_PREFIJO}${i}`,
        colorGoogle: coloresGoogle[(i - 1) % coloresGoogle.length]
    });
}

export const APP_CONFIG = {
    // === IDENTIDAD DE EMPRESA (MARCA BLANCA) ===
    EMPRESA_NOMBRE: EMPRESA_NOMBRE,
    EMPRESA_TELEFONO: EMPRESA_TELEFONO,
    EMPRESA_EMAIL: EMPRESA_EMAIL,
    EMPRESA_LOGO: EMPRESA_LOGO,

    // === INFORMACIÓN GENERAL ===
    nombreProyecto: EMPRESA_NOMBRE,
    zonaHoraria: 'America/Montevideo',
    telefonoConsultorio: EMPRESA_TELEFONO,
    roles: ["admin", "gestor", "usuario"],
    tiposDocumento: ["CI", "DNI", "Otros"],

    // === CONFIGURACIÓN DE UI ===
    estilos: { fondo: ESTILO_FONDO_CSS },
    pageSize: 10,
    toastDuracion: 6000, 
    comboAgendaSoloUsuarios: true,
    
    // === GESTIÓN DE ESPACIOS ===
    espacios: {
        etiquetaGeneral: ESPACIOS_ETIQUETA,
        etiquetaGeneralPlural: ESPACIOS_ETIQUETA_PLURAL,
        prefijoGeneral: ESPACIOS_PREFIJO,
        usarColoresEnAgenda: true,
        items: itemsGenerados 
    },
    
    paletaColoresGoogle: {
        "1": "#a4bdfc", "2": "#7ae7bf", "3": "#dbadff", "4": "#ff887c", 
        "5": "#fbd75b", "6": "#ffb878", "7": "#46d6db", "8": "#e1e1e1", 
        "9": "#5484ed", "10": "#51b749", "11": "#dc2127"
    },
    usuarioEmailDominio: USUARIO_DOMINIO_EMAIL,

    // === CALENDARIO Y HORARIOS ===
    diasLaborales: REGLA_DIAS_LABORALES,
    horarios: {
        inicio: REGLA_HORA_INICIO,
        fin: REGLA_HORA_FIN,
        intervalos: REGLA_INTERVALOS_MINUTOS,
        restriccionCierreSoloUsuarios: true 
    },
    horariosEspeciales: {
        6: { inicio: 8, fin: 15 } // Configuración específica de Sábados
    },

    // === RESERVAS Y CANCELACIONES ===
    maxSemanasReservaUsuario: REGLA_MAX_SEMANAS_FUTURO,
    // estadosReserva: { RESERVADA: 'Reservada',PENDIENTE: 'Pendiente' ,USADA: 'Usada', CANCELADA: 'Cancelada' },
    // Modelo de estados simplificado: solo estados mutables de una reserva
    estadosReserva: { PENDIENTE: 'Pendiente', CONSUMIDA: 'Consumida', CANCELADA: 'Cancelada' },
    cancelacion: {
        horasAntelacion: REGLA_HORAS_CANCELACION,
        reglaFinDeSemana: REGLA_FIN_DE_SEMANA 
    }
};