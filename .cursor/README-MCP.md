# MCP en este proyecto

Este proyecto incluye una configuración de **MCP (Model Context Protocol)** para que Cursor pueda usar diseños de Figma y Frontender al variar o mejorar la UI.

## Servidores configurados

- **figma-desktop**: servidor local de la app de escritorio de Figma (`http://127.0.0.1:3845/mcp`). Debe estar abierta la app Figma en tu máquina.
- **frontender-web-mcp**: servidor de Meli Office para diseño/código (`https://frontender-web-mcp.melioffice.com/mcp`).

## Cómo activar MCP en Cursor

1. Abrí **Cursor** → **Settings** → **Features** → **MCP**.
2. Si Cursor no toma automáticamente la config del proyecto, copiá el contenido de `.cursor/mcp.json` y agregalo a tu configuración global de MCP (por ejemplo en `~/.cursor/mcp.json`).
3. Para **figma-desktop**: asegurate de tener la **app de escritorio de Figma** abierta para que el servidor en el puerto 3845 esté activo.

## Cómo usar esto para variar la UI

Con los servidores MCP activos en Cursor, en el chat (Composer/Agent) podés pedir por ejemplo:

- *“Variá la UI de LottieExport según el frame [nombre] de mi archivo Figma [link]”*
- *“Aplicá el sistema de diseño de Frontender a la pantalla principal”*
- *“Usá los colores y tipografía del diseño de Figma que te pasé”*

El asistente podrá usar las herramientas de Figma y Frontender para leer diseños y aplicar cambios en el código del proyecto.

## Variación de UI en la app

Además, en la propia aplicación hay un **selector de tema** en el header (Andes, Noche, Suave) para cambiar la apariencia sin usar MCP.
