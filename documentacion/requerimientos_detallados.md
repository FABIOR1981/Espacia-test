# Requerimientos Detallados - Proyecto Espacia

Este documento describe los requerimientos funcionales y no funcionales de manera exhaustiva para que un lector humano o una IA pueda recrear el proyecto desde cero.

## 1. Objetivo del sistema
- Gestionar reservas de espacios (consultorios, camas, salas) con un flujo de agenda.
- Integrar con Google Calendar para persistencia de eventos.
- Fomentar roles: usuario, gestor y admin.
- Proveer informes (reservas, canceladas) y reportes PDF.

## 2. Ámbitos funcionales
### 2.1 Autenticación y seguridad
- Login con documento/nomUsu + contraseña hash (SHA-256).
- JWT para la sesión (temas: `tipdocu`, `documento`, `email`, `rol`, `nombre`, `nomUsu`).
- Control de acceso a funciones con roles:
  - usuario: crear/agendar, cancelar propias reservas, ver sus reservas.
  - gestor/admin: ver todas, cancelar cualquiera, generar informes, gestionar usuarios.

### 2.2 Agenda de reservas
- Agenda con vista por día + listado hora/intervalo con slots.
- Selección de consultorio (C1..Cn) y rango horario.
- Reservas con descripción en Google Calendar:
  - `Reserva para: <nombre>`
  - `Email: <email>`
  - `Consultorio: <x>`
  - `Hora: ...` etc.
  - `Reserva realizada por: <nombre>` si es admin/gestor.

### 2.3 Cancelación
- Al cancelar un evento se marca `Cancelada - <summary>`.
- Agrega en `description`: `Reserva Cancelada por: <nombre>`.
- Registro debe usar `userToken.nombre`; no ámbito de cliente inseguro.
- Para informes, `informe_canceladas` extrae quien canceló.

### 2.4 Informes y PDF
- Funciones Netlify: `informe_reservas`, `informe_canceladas`.
- PDF incluya resumen y detalle con columna `Cancelado por`.

### 2.5 Gestión de usuarios
- ABM mediante Netlify Functions: `gestionar_usuarios`, `listar_usuarios`, `update-usuarios`.

## 3. Requisitos no funcionales
- PWA (service worker cache con `sw.js/CACHE_NAME` y `config.APP_VERSION`).
- Frontend Vanilla JS + responsive.
- Código modular en `js/agenda`, `js/persistencia`, `js/pdf`.
- Uso de Netlify Functions para backend.

## 4. Datos y estructura
- `js/config.js`: valores del negocio, roles, horarios, etc.
- `package.json`: dependencias `googleapis`, `jsonwebtoken`, `@netlify/functions`.

## 5. Flujo de despliegue
- Mantener versiones:
  - package.json `version`
  - js/config.js `APP_VERSION`
  - sw.js `CACHE_NAME`
- Se aumenta patch por defecto.

## 6. Criterios de aceptación
- Usuario crea/cancela reserva y se refleja en Google Calendar.
- Informe canceladas muestra nombre correcto: titular o admin.
- Compraración `getCanceladoPor` lógica de nombres: si cancela titular, retorna titular, sino `Administración`.
- Workflow de actualizacion de versión y cache PWA funcional.
- Documentación (README, manual_usuario, estructura) completa.
