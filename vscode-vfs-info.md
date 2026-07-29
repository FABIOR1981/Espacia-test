# VFS / Repo Path Info for AI

Este archivo describe cómo interactuar con el proyecto cuando está abierto como una carpeta virtual (VFS) en VS Code.

## Rutas VFS
Usar siempre la ruta VFS exacta al leer o editar archivos si el proyecto viene de un repositorio remoto.

Ejemplo de ruta:
- `vscode-vfs://github/FABIOR1981/Espacia`

## Cómo avisar al asistente
Cuando el proyecto está en VFS, menciona explícitamente:
- "El proyecto está en el VFS"
- "La ruta es `vscode-vfs://github/FABIOR1981/Espacia`"
- El archivo actual abierto en el editor, por ejemplo `dashboard.html`.

## Qué evitar
- No usar rutas locales como `C:\Users\fabio\Espacia` cuando el explorador muestra `vscode-vfs://...`.
- No asumir que la copia local es la misma que el repositorio VFS.

## Por qué es importante
- En VS Code, el repositorio remoto se presenta como un sistema de archivos virtual.
- Las herramientas deben leer/escribir en el VFS para que los cambios sean visibles en el explorador.

## Resultado esperado
Si el proyecto viene del repositorio remoto y está abierto como VFS, todas las ediciones deben hacerse en archivos bajo la ruta:
- `vscode-vfs://github/FABIOR1981/Espacia`

Y el asistente debe usar esa ruta en lugar de buscar una copia local.
