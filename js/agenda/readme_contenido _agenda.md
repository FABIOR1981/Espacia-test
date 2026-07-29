# Estructura de `js/agenda`

Este directorio aloja la lógica modular de la Agenda V2 con enfoque MVC ligero y funciones de reserva/cancelación. Está pensado como un conjunto de módulos reutilizables que manejan estado, API, vista y acciones de usuario.

- `agenda_estado.js`
  - Estado global de agenda (fecha actual, usuario logueado, rol, selección admin, lista de usuarios y filtros de espacio).
  - Funciones auxiliares: formateo de fecha, validación de día laboral, cálculo de intervalo de horas y estado de disponibilidad.

- `agenda_api.js`
  - Llamadas a Netlify Functions (`get-usuarios`, `informe_reservas`, `informe_canceladas`, `reservar`, etc.).
  - Centraliza `fetch` con headers de autenticación y manejo de errores (reintentos ligeros, timeout configurable).

- `agenda_vista.js`
  - Render de interfaz inicial: encabezado, fecha, mensajes de no laboral/errores y botonera de interés.
  - Capa de presentación independiente de la lógica, facilita adaptación a temas y a futuros frameworks.

- `agenda_controlador.js`
  - Orquesta flujo principal.
  - Carga datos, inicializa componente, controla recarga periódica (60s) y lógica de cuadrícula.
  - Calcula consultorios visibles y monta reservas en pantalla, con soporte de paginación y filtros.

- `agenda_reservar.js` (existente)
  - Lógica de reserva/cancelación para UI de booking.
  - Integración con `window.iniciarReservaV2`, validaciones de intervalo, y guardado de `creadoPor` cuando el operador es admin/gestor.

- `agenda_cancelar.js` (existente)
  - Interacción para cancelar reservas.
  - Genera la marca `Cancelada - ...` y llama a `reservar` DELETE.

- `agenda_detalle.js` (existente)
  - Muestra detalle de una reserva, con campos de resumen, estado y botón de impresión/descarga.
  - Formatea los metadatos del evento (`Reserva realizada por`, `Reserva cancelada por`, `consultorio`, etc.).

## Notas de mantenimiento

- Las funciones clave se llaman desde `agenda_v2.js` (entry point principal de la agenda). No omitir su carga.
- Si se renombra CSS o scripts, actualizar también `sw.js` y `js/config.js` para forzar cache-bust.
- Observa que el módulo `agenda_reservar.js` dejó el código de propiedad `userEmail` en `extendedProperties` y puede necesitar refactor según privacidad.

## Recomendaciones de refactor

- Consolidar selectores y DOM-manipulación en `agenda_vista.js`.
- Convertir las llamadas a Netlify a un wrapper reutilizable en `agenda_api.js`.
- Añadir tests unitarios (mock de `fetch` y `googleapis` para los endpoints).
