// js/config.js

import {
    APP_VERSION,
    SHOW_UPDATE_MODAL,
    EMPRESA_NOMBRE,
    EMPRESA_TELEFONO,
    EMPRESA_EMAIL,
    EMPRESA_LOGO,
    ESPACIOS_CANTIDAD,
    ESPACIOS_ETIQUETA,
    ESPACIOS_PREFIJO,
    USUARIO_DOMINIO_EMAIL,
    ESTILO_FONDO_CSS,
    REGLA_DIAS_LABORALES,
    REGLA_HORA_INICIO,
    REGLA_HORA_FIN,
    REGLA_INTERVALOS_MINUTOS,
    REGLA_HORAS_CANCELACION,
    REGLA_FIN_DE_SEMANA,
    REGLA_MAX_SEMANAS_FUTURO
} from './config_particular.js';

export const TIPOS_CUPONERA = ['10', '20'];

// ==============================================================================
// 1. CONFIGURACIÓN DEL CLIENTE (MARCA BLANCA)
// ==============================================================================
// Estas son las únicas variables que debes modificar al clonar el sistema para un cliente nuevo.

// ATENCIÓN: Al cambiar esta versión, hazlo también en sw.js (CACHE_NAME) para forzar la actualización en los móviles de los clientes.
export { APP_VERSION, SHOW_UPDATE_MODAL };

// A. Identidad de la Empresa
export { EMPRESA_NOMBRE, EMPRESA_TELEFONO, EMPRESA_EMAIL, EMPRESA_LOGO };

// B. Entidad a Alquilar/Reservar (Ej: "Consultorio - C", "Box - B", "Mesa - M")
export const ESPACIOS_ETIQUETA_PLURAL = ESPACIOS_ETIQUETA + "s"; // Para textos como "No hay Consultorios disponibles"

// C. Configuración de Usuarios por defecto
export { USUARIO_DOMINIO_EMAIL };

// D. Reglas de Negocio y Horarios
// Estos valores están definidos en config_particular.js para facilitar su ajuste cliente a cliente.

// E. Estética
// ESTILO_FONDO_CSS se importa desde config_particular.js

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
    tiposDocumento: ["PROF","SIS"],

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