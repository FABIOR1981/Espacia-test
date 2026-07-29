// js/config_particular.js

// Valores particulares del cliente / despliegue.
// Este archivo solo debe contener variables específicas de marca, empresa y despliegue.

export const APP_VERSION = '4.9.17';
export const SHOW_UPDATE_MODAL = true;

export const EMPRESA_NOMBRE = 'De Maria Consultorios';
export const EMPRESA_TELEFONO = '091001334';
export const EMPRESA_EMAIL = 'demariaconsultorios1334@gmail.com';
export const EMPRESA_LOGO = 'imagenes/logo_demaria.png';

export const ESPACIOS_CANTIDAD = 5;
export const ESPACIOS_ETIQUETA = 'Consultorio';
export const ESPACIOS_PREFIJO = 'C';

export const USUARIO_DOMINIO_EMAIL = '@espacia.com.uy';

export const REGLA_DIAS_LABORALES = [1, 2, 3, 4, 5, 6]; // 0=Dom, 1=Lun... 6=Sáb
export const REGLA_HORA_INICIO = 8; // 08:00
export const REGLA_HORA_FIN = 22;   // 22:00
export const REGLA_INTERVALOS_MINUTOS = [60, 90]; // Duraciones permitidas en el combo

export const REGLA_HORAS_CANCELACION = 24; // Cuántas horas antes puede cancelar un usuario normal
export const REGLA_FIN_DE_SEMANA = false;  // Si es true, el Lunes cuenta como 72hs de anticipación
export const REGLA_MAX_SEMANAS_FUTURO = 12; // Cuántas semanas hacia adelante puede agendar un usuario

export const ESTILO_FONDO_CSS = 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)';
