# LottieExport

Convertí animaciones Lottie y Jitter a videos de alta calidad (MP4, WebM) o GIFs animados.

---

## 🚀 Inicio Rápido

1. Descomprimí el ZIP
2. Abrí la carpeta **LottieExport** en Cursor
3. Abrí la terminal (`Cmd + J`)
4. Instalá dependencias (solo la primera vez):

```bash
npm install
```

5. Iniciá la herramienta:

```bash
npm run dev
```

6. Se abre el navegador solo; si no, usá la URL que muestra la terminal (por defecto **http://localhost:5177/**; si ese puerto estaba ocupado, puede ser 5178 u otro).

> **Requisito:** Tener [Node.js](https://nodejs.org) instalado (v18 o superior)

---

## Características

- 🎬 **Múltiples Formatos**: Exportá a MP4, WebM o GIF
- 📐 **Resolución Personalizable**: Presets (4K, 1080p, 720p) o dimensiones custom
- 🎯 **Control de FPS**: 24, 30, 60 o 120 cuadros por segundo
- 📊 **Configuración de Calidad**: Bitrate ajustable de 1 a 50 Mbps
- 👀 **Vista Previa en Vivo**: Reproducí tu animación antes de exportar
- 🔒 **Privacidad**: Todo se procesa en tu navegador, sin subidas a servidores

---

## Uso

1. **Arrastrá un archivo Lottie** (.json) a la zona de carga
2. **Previsualizá** tu animación
3. **Configurá** los ajustes de exportación
4. **Exportá** y descargá tu video/GIF

---

## Tips de Optimización

| Destino | Formato | Resolución | FPS | Peso máx |
|---------|---------|------------|-----|----------|
| **Figma** | GIF | 720p o menor | 24-30 | <5MB |
| **Google Slides** | GIF | 720p | 24 | <5MB |
| **Google Slides** | Video | 1080p | 30 | - |

---

## Compatibilidad

Requiere un navegador moderno:
- ✅ Chrome 89+
- ✅ Firefox 79+
- ✅ Edge 89+
- ❌ Safari (sin soporte para SharedArrayBuffer)

---

## Licencia

MIT
