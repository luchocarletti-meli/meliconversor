import { useState, useMemo } from 'react'
import './ExportSettings.css'
import { MAX_FRAMES_DEFAULT } from '../utils/videoToLottieJson'

const FORMAT_OPTIONS_BASE = [
  { value: 'mp4',  label: 'MP4',  description: 'Mejor calidad' },
  { value: 'webm', label: 'WebM', description: 'Con transparencia' },
  { value: 'gif',  label: 'GIF',  description: 'Archivo pesado' },
]

const FORMAT_OPTION_JSON_VIDEO = {
  value: 'json', label: 'Lottie JSON', description: 'Video → animación Lottie',
}

const FORMAT_OPTION_JSON_LOTTIE = {
  value: 'json', label: 'JSON', description: 'Exportar Lottie editado',
}

const RESOLUTION_PRESETS = [
  { label: 'Original', value: 'original', height: null },
  { label: '4K',       value: '4k',       height: 2160 },
  { label: '1080p',    value: '1080p',     height: 1080 },
  { label: '720p',     value: '720p',      height: 720  },
  { label: '480p',     value: '480p',      height: 480  },
  { label: 'Custom',   value: 'custom',    height: null },
]

const FPS_OPTIONS = [24, 30, 60, 120]

const GIF_COMPRESSION_PRESETS = [
  { value: 'low',    label: 'Baja',  description: 'Mejor calidad' },
  { value: 'medium', label: 'Media', description: 'Balanceado'    },
  { value: 'high',   label: 'Alta',  description: 'Más liviano'   },
]

const QUALITY_PRESETS = [
  { value: 'low',    label: 'Baja',  bitrate: 2,    description: 'Archivo pequeño' },
  { value: 'medium', label: 'Media', bitrate: 5,    description: 'Balanceado'      },
  { value: 'high',   label: 'Alta',  bitrate: 10,   description: 'Buena calidad'   },
  { value: 'ultra',  label: 'Ultra', bitrate: 20,   description: 'Máxima calidad'  },
  { value: 'custom', label: 'Manual',bitrate: null, description: 'Configurar'      },
]

function ExportSettings({ settings, onChange, originalWidth, originalHeight, originalFps, duration, isVideoSource }) {
  const [resolutionMode, setResolutionMode] = useState('original')
  const [qualityMode, setQualityMode]       = useState('high')
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [gifCompression, setGifCompression] = useState('medium')

  const formatOptions = useMemo(
    () => isVideoSource
      ? [...FORMAT_OPTIONS_BASE, FORMAT_OPTION_JSON_VIDEO]
      : [...FORMAT_OPTIONS_BASE, FORMAT_OPTION_JSON_LOTTIE],
    [isVideoSource]
  )

  const aspectRatio = originalWidth / originalHeight

  const handleFormatChange = (format) => {
    if (format === 'gif' && settings.fps > 30) {
      onChange({ ...settings, format, fps: 30 })
    } else {
      onChange({ ...settings, format })
    }
  }

  const handleResolutionPreset = (presetValue) => {
    setResolutionMode(presetValue)
    if (presetValue === 'original') {
      onChange({ ...settings, width: originalWidth, height: originalHeight })
    } else if (presetValue !== 'custom') {
      const preset = RESOLUTION_PRESETS.find(p => p.value === presetValue)
      if (preset?.height) {
        const targetHeight = preset.height
        const targetWidth  = Math.round(targetHeight * aspectRatio)
        const evenWidth    = targetWidth  % 2 === 0 ? targetWidth  : targetWidth  + 1
        const evenHeight   = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1
        onChange({ ...settings, width: evenWidth, height: evenHeight })
      }
    }
  }

  const handleWidthChange = (e) => {
    const width  = parseInt(e.target.value) || 0
    const height = lockAspectRatio ? Math.round(width / aspectRatio) : settings.height
    onChange({ ...settings, width, height })
    setResolutionMode('custom')
  }

  const handleHeightChange = (e) => {
    const height = parseInt(e.target.value) || 0
    const width  = lockAspectRatio ? Math.round(height * aspectRatio) : settings.width
    onChange({ ...settings, width, height })
    setResolutionMode('custom')
  }

  const handleQualityPreset = (preset) => {
    setQualityMode(preset)
    const quality = QUALITY_PRESETS.find(q => q.value === preset)
    if (quality?.bitrate !== null) {
      onChange({ ...settings, bitrate: quality.bitrate, quality: preset })
    }
  }

  const handleBitrateChange = (e) => {
    onChange({ ...settings, bitrate: parseFloat(e.target.value) || 1 })
    setQualityMode('custom')
  }

  const handleMaxSizeChange = (e) => {
    const value = e.target.value
    onChange({ ...settings, maxSize: value === '' ? null : parseFloat(value) })
  }

  const handleGifCompressionChange = (compression) => {
    setGifCompression(compression)
    onChange({ ...settings, gifCompression: compression })
  }

  const handleCropBlackBarsToggle = () => {
    onChange({ ...settings, cropBlackBars: (settings.cropBlackBars || 'off') === 'auto' ? 'off' : 'auto' })
  }

  // Estimated file size
  const animDuration   = duration || 2
  const effectiveFps   = settings.format === 'gif' ? Math.min(settings.fps, 30) : settings.fps
  const totalFrames    = Math.round(effectiveFps * animDuration)
  const pixels         = settings.width * settings.height

  let estimatedSizeMin, estimatedSizeMax
  if (settings.format === 'json') {
    const cappedFrames  = Math.min(Math.ceil(animDuration * settings.fps), MAX_FRAMES_DEFAULT)
    const raw           = cappedFrames * pixels * 0.14
    estimatedSizeMin    = (raw * 0.85) / (1024 * 1024)
    estimatedSizeMax    = (raw * 1.25) / (1024 * 1024)
  } else if (settings.format === 'gif') {
    const factors       = { low: { min: 0.15, max: 0.4 }, medium: { min: 0.08, max: 0.25 }, high: { min: 0.04, max: 0.15 } }
    const f             = factors[gifCompression] || factors.medium
    estimatedSizeMin    = (pixels * totalFrames * f.min) / (1024 * 1024)
    estimatedSizeMax    = (pixels * totalFrames * f.max) / (1024 * 1024)
  } else {
    const baseSizeMB    = (settings.bitrate * animDuration) / 8
    const resFactor     = Math.sqrt(pixels / 2073600)
    const base          = baseSizeMB * Math.max(0.3, Math.min(1.5, resFactor))
    estimatedSizeMin    = base * 0.2
    estimatedSizeMax    = base * 1.0
  }

  const isHeavyConfig = (settings.height >= 2160 && settings.fps >= 60) ||
                        (settings.height >= 1080 && settings.fps >= 120)

  const selectedFormat = formatOptions.find(f => f.value === settings.format)

  return (
    <div className="export-settings">
      <h2 className="export-settings__title">Exportar</h2>

      {/* ── Formato ───────────────────────────────── */}
      <div className="export-settings__section">
        <label className="export-settings__label">Formato</label>
        <div className="export-settings__pill-group">
          {formatOptions.map(format => (
            <button
              key={format.value + format.label}
              className={`export-settings__pill-btn ${settings.format === format.value ? 'export-settings__pill-btn--active' : ''}`}
              onClick={() => handleFormatChange(format.value)}
            >
              {format.label}
            </button>
          ))}
        </div>

        {selectedFormat && (
          <p className="export-settings__format-desc">{selectedFormat.description}</p>
        )}

        {settings.format === 'gif' && (
          <div className="export-settings__notice export-settings__notice--warning">
            Los GIFs pesan mucho más que los videos. Para redes sociales, considerá MP4.
          </div>
        )}
        {settings.format === 'webm' && (
          <div className="export-settings__notice export-settings__notice--info">
            WebM soporta transparencia. Ideal para overlays con fondo transparente.
          </div>
        )}
        {settings.format === 'json' && isVideoSource && (
          <div className="export-settings__notice export-settings__notice--warning">
            Genera un Lottie con una imagen por cuadro. Máximo {MAX_FRAMES_DEFAULT} cuadros.
          </div>
        )}
      </div>

      {/* ── Fondo (solo Lottie) ────────────────────── */}
      {!isVideoSource && (
        <div className="export-settings__section">
          <label className="export-settings__label">Fondo</label>
          <div className="export-settings__pill-group">
            <button
              className={`export-settings__pill-btn ${!settings.transparentBackground ? 'export-settings__pill-btn--active' : ''}`}
              onClick={() => onChange({ ...settings, transparentBackground: false })}
            >
              Opaco
            </button>
            <button
              className={`export-settings__pill-btn ${settings.transparentBackground ? 'export-settings__pill-btn--active' : ''}`}
              onClick={() => onChange({ ...settings, transparentBackground: true })}
            >
              Transparente
            </button>
          </div>
          {settings.transparentBackground && settings.format === 'mp4' && (
            <div className="export-settings__notice export-settings__notice--warning">
              MP4 no soporta transparencia. Elegí WebM o GIF.
            </div>
          )}
        </div>
      )}

      {/* ── Watermark (solo Lottie) ───────────────── */}
      {!isVideoSource && (
        <div className="export-settings__section export-settings__section--toggle">
          <div>
            <label className="export-settings__label">Eliminar watermark</label>
            <p className="export-settings__sublabel">Quita logos de jitter, lottiefiles, etc.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!settings.removeLogo}
            className={`export-settings__toggle ${settings.removeLogo ? 'export-settings__toggle--on' : ''}`}
            onClick={() => onChange({ ...settings, removeLogo: !settings.removeLogo })}
          >
            <span className="export-settings__toggle-track">
              <span className="export-settings__toggle-thumb" />
            </span>
          </button>
        </div>
      )}

      {/* ── Quitar barras negras (solo video) ─────── */}
      {isVideoSource && settings.format !== 'json' && (
        <div className="export-settings__section export-settings__section--toggle">
          <div>
            <label className="export-settings__label">Quitar barras negras</label>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={(settings.cropBlackBars || 'off') === 'auto'}
            className={`export-settings__toggle ${(settings.cropBlackBars || 'off') === 'auto' ? 'export-settings__toggle--on' : ''}`}
            onClick={handleCropBlackBarsToggle}
          >
            <span className="export-settings__toggle-track">
              <span className="export-settings__toggle-thumb" />
            </span>
          </button>
        </div>
      )}

      {/* ── Resolución ────────────────────────────── */}
      <div className="export-settings__section">
        <div className="export-settings__label-row">
          <label className="export-settings__label">Resolución</label>
          <span className="export-settings__hint">Original: {originalWidth}×{originalHeight}</span>
        </div>
        <div className="export-settings__pill-group export-settings__pill-group--wrap">
          {RESOLUTION_PRESETS.map(preset => (
            <button
              key={preset.value}
              className={`export-settings__pill-btn ${resolutionMode === preset.value ? 'export-settings__pill-btn--active' : ''}`}
              onClick={() => handleResolutionPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="export-settings__dimensions">
          <div className="export-settings__dimension-input">
            <span className="export-settings__dimension-label">W</span>
            <input type="number" value={settings.width}  onChange={handleWidthChange}  min={1} max={7680} />
            <span className="export-settings__dimension-unit">px</span>
          </div>

          <button
            className={`export-settings__lock-btn ${lockAspectRatio ? 'export-settings__lock-btn--active' : ''}`}
            onClick={() => setLockAspectRatio(!lockAspectRatio)}
            title={lockAspectRatio ? 'Desbloquear proporción' : 'Bloquear proporción'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {lockAspectRatio ? (
                <path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-6h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2z"/>
              ) : (
                <>
                  <path d="M12 17a2 2 0 100-4 2 2 0 000 4z"/>
                  <path d="M17 11h1a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2h1"/>
                  <path d="M7 11V7a5 5 0 019.9-1"/>
                </>
              )}
            </svg>
          </button>

          <div className="export-settings__dimension-input">
            <span className="export-settings__dimension-label">H</span>
            <input type="number" value={settings.height} onChange={handleHeightChange} min={1} max={7680} />
            <span className="export-settings__dimension-unit">px</span>
          </div>
        </div>
      </div>

      {/* ── FPS ───────────────────────────────────── */}
      <div className="export-settings__section">
        <div className="export-settings__label-row">
          <label className="export-settings__label">Cuadros por segundo</label>
          <span className="export-settings__hint">Original: {originalFps} fps</span>
        </div>
        <div className="export-settings__pill-group">
          {FPS_OPTIONS.map(fps => (
            <button
              key={fps}
              className={`export-settings__pill-btn ${settings.fps === fps ? 'export-settings__pill-btn--active' : ''} ${settings.format === 'gif' && fps > 30 ? 'export-settings__pill-btn--warning' : ''}`}
              onClick={() => onChange({ ...settings, fps })}
            >
              {fps} fps
            </button>
          ))}
        </div>
        {settings.format === 'gif' && settings.fps > 30 && (
          <p className="export-settings__notice export-settings__notice--warning">Para GIF se recomienda máximo 30 fps</p>
        )}
      </div>

      {/* ── Compresión GIF ────────────────────────── */}
      {settings.format === 'gif' && (
        <div className="export-settings__section">
          <label className="export-settings__label">Compresión</label>
          <div className="export-settings__pill-group">
            {GIF_COMPRESSION_PRESETS.map(preset => (
              <button
                key={preset.value}
                className={`export-settings__pill-btn ${gifCompression === preset.value ? 'export-settings__pill-btn--active' : ''}`}
                onClick={() => handleGifCompressionChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Calidad (video, no GIF/JSON) ─────────── */}
      {settings.format !== 'gif' && settings.format !== 'json' && (
        <div className="export-settings__section">
          <label className="export-settings__label">Calidad</label>
          <div className="export-settings__pill-group export-settings__pill-group--wrap">
            {QUALITY_PRESETS.map(quality => (
              <button
                key={quality.value}
                className={`export-settings__pill-btn ${qualityMode === quality.value ? 'export-settings__pill-btn--active' : ''}`}
                onClick={() => handleQualityPreset(quality.value)}
              >
                {quality.label}
              </button>
            ))}
          </div>

          <div className="export-settings__bitrate-row">
            <label className="export-settings__sublabel">Bitrate</label>
            <div className="export-settings__bitrate-input">
              <input
                type="range" min={1} max={50} step={0.5}
                value={settings.bitrate}
                onChange={handleBitrateChange}
              />
              <span className="export-settings__bitrate-value">{settings.bitrate} Mbps</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tamaño máximo ─────────────────────────── */}
      <div className="export-settings__section">
        <label className="export-settings__label">Tamaño máximo</label>
        <div className="export-settings__maxsize-input">
          <input
            type="number"
            placeholder="Sin límite"
            value={settings.maxSize ?? ''}
            onChange={handleMaxSizeChange}
            min={0.1} step={0.1}
          />
          <span className="export-settings__maxsize-unit">MB</span>
        </div>
      </div>

      {/* ── Resumen estimado ──────────────────────── */}
      <div className={`export-settings__summary ${isHeavyConfig ? 'export-settings__summary--warning' : ''}`}>
        <span className="export-settings__summary-item">{settings.width}×{settings.height}</span>
        <span className="export-settings__summary-dot">·</span>
        <span className="export-settings__summary-item">{effectiveFps} fps</span>
        <span className="export-settings__summary-dot">·</span>
        <span className="export-settings__summary-item">~{estimatedSizeMin.toFixed(1)}–{estimatedSizeMax.toFixed(1)} MB</span>
      </div>
    </div>
  )
}

export default ExportSettings
