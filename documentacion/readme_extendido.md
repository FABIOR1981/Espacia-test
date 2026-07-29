# README Extendido - Proyecto Espacia

Este documento complementa al `README.md` raíz con más detalles sobre la arquitectura, componentes y reglas de negocio.

## 1. Estructura general
- `index.html`, `dashboard.html`: vistas principales.
- `js/`: lógica cliente, con subcomponentes:
  - `agenda_v2.js`, `agenda/` (Módulos de Agenda v2)
  - `persistencia/abm_usuario.js` (CRUD de usuarios en frontend)
  - `pdf` (generación de PDF de tickets e informes)
  - `utils.js`, `config.js`.
- `css/`: temas separados (comunes, ABM, agenda, dashboard, login, etc.).
- `sw.js`: service worker PWA + cache.
- `netlify/functions`: backend de Netlify (Google Calendar + auth jwt + lógica de informes/usuarios/reservas).

## 2. Reglas de negocio clave
- Rol `admin`/`gestor` puede crear reservas en nombre de usuarios y cancelar cualquier evento.
- Rol `usuario` solo puede gestionar sus reservas propias.
- Reserva cancelada bajo rol admin: en Google Calendar aparezca `Reserva Cancelada por: <nombre_del_admin>`.
- `getCanceladoPor` define como titular si son mismos nombres; si no, `Administración`.

## 3. Detalle de Netlify Functions
- `login.js`: devuelde JWT + datos de usuario.
- `reservar.js`: POST para crear, DELETE para cancelar, GET para consultar; forzar `userToken.nombre`.
- `informe_reservas.js` / `informe_canceladas.js`: extraen eventos usando `googleapis`, parsean descripción.
- `gestionar_usuarios.js`, `listar_usuarios.js`, `update-usuarios.js`: admin user management.
- `backup-reservas.js` (programa backups vía scheduler).

## 4. PWA y cache-busting
- `sw.js` usa `CACHE_NAME` derivado de `APP_VERSION`.
- Cambios de versión en: `package.json`, `js/config.js`, `sw.js`.
- Renovar version automáticamente on release para forzar nueva caché.

## 5. Comportamiento de UI
- Agenda cargada cada 60 segundos.
- Mensajes de error de red integrados.
- Modal de confirmación para acciones críticas (cancelar, borrar usuario).

## 6. Mantenimiento y calidad
- Usa regla ESLint `no-unused-vars` para detectar código husmeado (como fragmentos no usados en `reservar.js`).
- Usa tests integrados con mock de `googleapis` en CI.
- Documenta cada nueva función en `js/agenda/readme_contenido_agenda.md`.
