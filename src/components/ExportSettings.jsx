import { useState, useMemo } from 'react'
import './ExportSettings.css'
import { MAX_FRAMES_DEFAULT } from '../utils/videoToLottieJson'

const FORMAT_OPTIONS_BASE = [
  { value: 'mp4', label: 'MP4', icon: '🎬', description: 'Mejor calidad' },
  { value: 'webm', label: 'WebM', icon: '🌐', description: 'Con transparencia' },
  { value: 'gif', label: 'GIF', icon: '✨', description: 'Archivo pesado' },
]

const FORMAT_OPTION_JSON_VIDEO = {
  value: 'json',
  label: 'Lottie JSON',
  icon: '📄',
  description: 'Video → animación Lottie',
}

const FORMAT_OPTION_JSON_LOTTIE = {
  value: 'json',
  label: 'Guardar JSON',
  icon: '💾',
  description: 'Exportar Lottie editado',
}

// Resolution presets - value is TARGET HEIGHT (the "p" in 1080p means height)
const RESOLUTION_PRESETS = [
  { label: 'Original', value: 'original', height: null },
  { label: '4K', value: '4k', height: 2160 },
  { label: '1080p', value: '1080p', height: 1080 },
  { label: '720p', value: '720p', height: 720 },
  { label: '480p', value: '480p', height: 480 },
  { label: 'Personalizado', value: 'custom', height: null },
]

const FPS_OPTIONS = [24, 30, 60, 120]

const GIF_COMPRESSION_PRESETS = [
  { value: 'low', label: 'Baja', description: 'Mejor calidad' },
  { value: 'medium', label: 'Media', description: 'Balanceado' },
  { value: 'high', label: 'Alta', description: 'Archivo liviano' },
]

const QUALITY_PRESETS = [
  { value: 'low', label: 'Baja', bitrate: 2, description: 'Archivo pequeño' },
  { value: 'medium', label: 'Media', bitrate: 5, description: 'Balanceado' },
  { value: 'high', label: 'Alta', bitrate: 10, description: 'Buena calidad' },
  { value: 'ultra', label: 'Ultra', bitrate: 20, description: 'Máxima calidad' },
  { value: 'custom', label: 'Manual', bitrate: null, description: 'Configurar' },
]

const TRANSPARENT_BACKGROUND_OPTIONS = [
  { value: false, label: 'Con fondo', description: 'Fondo opaco' },
  { value: true, label: 'Sin fondo', description: 'Transparente (tipo PNG)' },
]

function ExportSettings({ settings, onChange, originalWidth, originalHeight, originalFps, duration, isVideoSource, hasDetectableLogo }) {
  const [resolutionMode, setResolutionMode] = useState('original')
  const [qualityMode, setQualityMode] = useState('high')
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
    // For GIF, suggest lower FPS to reduce file size
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
    } else if (presetValue === 'custom') {
      // Keep current values
    } else {
      const preset = RESOLUTION_PRESETS.find(p => p.value === presetValue)
      if (preset && preset.height) {
        // Calculate width based on target height, maintaining aspect ratio
        const targetHeight = preset.height
        const targetWidth = Math.round(targetHeight * aspectRatio)
        // Ensure even dimensions for video encoding
        const evenWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1
        const evenHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1
        onChange({ ...settings, width: evenWidth, height: evenHeight })
      }
    }
  }

  const handleWidthChange = (e) => {
    const width = parseInt(e.target.value) || 0
    const height = lockAspectRatio ? Math.round(width / aspectRatio) : settings.height
    onChange({ ...settings, width, height })
    setResolutionMode('custom')
  }

  const handleHeightChange = (e) => {
    const height = parseInt(e.target.value) || 0
    const width = lockAspectRatio ? Math.round(height * aspectRatio) : settings.width
    onChange({ ...settings, width, height })
    setResolutionMode('custom')
  }

  const handleFpsChange = (fps) => {
    onChange({ ...settings, fps })
  }

  const handleQualityPreset = (preset) => {
    setQualityMode(preset)
    const quality = QUALITY_PRESETS.find(q => q.value === preset)
    if (quality && quality.bitrate !== null) {
      onChange({ ...settings, bitrate: quality.bitrate, quality: preset })
    }
  }

  const handleBitrateChange = (e) => {
    const bitrate = parseFloat(e.target.value) || 1
    onChange({ ...settings, bitrate })
    setQualityMode('custom')
  }

  const handleMaxSizeChange = (e) => {
    const value = e.target.value
    const maxSize = value === '' ? null : parseFloat(value)
    onChange({ ...settings, maxSize })
  }

  const handleGifCompressionChange = (compression) => {
    setGifCompression(compression)
    onChange({ ...settings, gifCompression: compression })
  }

  const handleCropBlackBarsToggle = () => {
    onChange({ ...settings, cropBlackBars: (settings.cropBlackBars || 'off') === 'auto' ? 'off' : 'auto' })
  }

  const handleTransparentBackgroundChange = (value) => {
    onChange({ ...settings, transparentBackground: value })
  }

  // Calculate estimated file size range based on parameters
  const animDuration = duration || 2 // fallback to 2 seconds
  const effectiveFps = settings.format === 'gif' ? Math.min(settings.fps, 30) : settings.fps
  const totalFrames = Math.round(effectiveFps * animDuration)
  const pixels = settings.width * settings.height
  
  let estimatedSizeMin, estimatedSizeMax
  if (settings.format === 'json') {
    const cappedFrames = Math.min(Math.ceil(animDuration * settings.fps), MAX_FRAMES_DEFAULT)
    const approxPerFrame = pixels * 0.14
    const raw = cappedFrames * approxPerFrame
    estimatedSizeMin = (raw * 0.85) / (1024 * 1024)
    estimatedSizeMax = (raw * 1.25) / (1024 * 1024)
  } else if (settings.format === 'gif') {
    // GIF size varies by compression level
    const compressionFactors = {
      low: { min: 0.15, max: 0.4 },    // Best quality = larger
      medium: { min: 0.08, max: 0.25 }, // Balanced
      high: { min: 0.04, max: 0.15 }    // High compression = smaller
    }
    const factors = compressionFactors[gifCompression] || compressionFactors.medium
    const totalBytesMin = pixels * totalFrames * factors.min
    const totalBytesMax = pixels * totalFrames * factors.max
    estimatedSizeMin = totalBytesMin / (1024 * 1024)
    estimatedSizeMax = totalBytesMax / (1024 * 1024)
  } else {
    // Video with CRF: size depends heavily on content complexity
    // Simple animations compress much better than complex ones
    const baseSizeMB = (settings.bitrate * animDuration) / 8
    const resolutionFactor = Math.sqrt(pixels / 2073600)
    const baseEstimate = baseSizeMB * Math.max(0.3, Math.min(1.5, resolutionFactor))
    // Range: 20% to 100% of base estimate (CRF compresses efficiently)
    estimatedSizeMin = baseEstimate * 0.2
    estimatedSizeMax = baseEstimate * 1.0
  }

  // Detect heavy configurations (4K + high FPS)
  const isHeavyConfig = (settings.height >= 2160 && settings.fps >= 60) || 
                        (settings.height >= 1080 && settings.fps >= 120)

  return (
    <div className="export-settings">
      <h2 className="export-settings__title">Configuración de Exportación</h2>
      
      {/* Format Selection */}
      <div className="export-settings__section">
        <label className="export-settings__label">Formato</label>
        <div className="export-settings__format-grid">
          {formatOptions.map(format => (
            <button
              key={format.value}
              className={`export-settings__format-btn ${settings.format === format.value ? 'export-settings__format-btn--active' : ''}`}
              onClick={() => handleFormatChange(format.value)}
            >
              <span className="export-settings__format-icon">{format.icon}</span>
              <span className="export-settings__format-label">{format.label}</span>
              <span className="export-settings__format-desc">{format.description}</span>
            </button>
          ))}
        </div>
        
        {settings.format === 'gif' && (
          <div className="export-settings__warning">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span>Los GIFs pesan mucho más que los videos. Para redes sociales, considerá MP4.</span>
          </div>
        )}
        
        {settings.format === 'webm' && (
          <div className="export-settings__info">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <span>WebM soporta transparencia. Ideal para overlays y animaciones con fondo transparente.</span>
          </div>
        )}

        {settings.format === 'json' && isVideoSource && (
          <div className="export-settings__warning">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span>
              Genera un Lottie válido con una imagen JPEG por cuadro (no es vectorial como un Lottie de After Effects).
              Máximo {MAX_FRAMES_DEFAULT} cuadros; archivos largos o en alta resolución pesan mucho.
              Si el navegador no puede decodificar el video (p. ej. algunos MOV), se usa FFmpeg automáticamente cuando ya cargó.
            </span>
          </div>
        )}
        
      </div>

      {/* Fondo transparente - solo para Lottie */}
      {!isVideoSource && (
        <div className="export-settings__section">
          <label className="export-settings__label">Fondo</label>
          <div className="export-settings__transparent-grid">
            {TRANSPARENT_BACKGROUND_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                className={`export-settings__transparent-btn ${settings.transparentBackground === opt.value ? 'export-settings__transparent-btn--active' : ''}`}
                onClick={() => handleTransparentBackgroundChange(opt.value)}
              >
                <span className="export-settings__transparent-label">{opt.label}</span>
                <span className="export-settings__transparent-desc">{opt.description}</span>
              </button>
            ))}
          </div>
          {settings.transparentBackground && (
            <div className="export-settings__info">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
              <span>
                {settings.format === 'mp4' 
                  ? 'MP4 no soporta transparencia. Elegí WebM o GIF para exportar sin fondo.'
                  : 'Se quitarán capas de fondo del Lottie y se exportará con transparencia (GIF/WebM tipo PNG).'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Eliminar logo/watermark - siempre visible para Lottie */}
      {!isVideoSource && (
        <div className="export-settings__section export-settings__section--toggle">
          <div>
            <label className="export-settings__label">Eliminar watermark</label>
            <p className="export-settings__sublabel">Quita capas de logo (jitter, lottiefiles, etc.)</p>
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
            <span className="export-settings__toggle-label">
              {settings.removeLogo ? 'Activado' : 'Desactivado'}
            </span>
          </button>
        </div>
      )}

      {/* Crop black bars - solo para video, toggle on/off */}
      {isVideoSource && settings.format !== 'json' && (
        <div className="export-settings__section export-settings__section--toggle">
          <label className="export-settings__label">Quitar barras negras</label>
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
            <span className="export-settings__toggle-label">
              {(settings.cropBlackBars || 'off') === 'auto' ? 'Encendido' : 'Apagado'}
            </span>
          </button>
        </div>
      )}

      {/* Resolution */}
      <div className="export-settings__section">
        <label className="export-settings__label">Resolución</label>
        <div className="export-settings__presets">
          {RESOLUTION_PRESETS.map(preset => (
            <button
              key={preset.value}
              className={`export-settings__preset-btn ${resolutionMode === preset.value ? 'export-settings__preset-btn--active' : ''}`}
              onClick={() => handleResolutionPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        <div className="export-settings__dimensions">
          <div className="export-settings__dimension-input">
            <span className="export-settings__dimension-label">A</span>
            <input
              type="number"
              value={settings.width}
              onChange={handleWidthChange}
              min={1}
              max={7680}
            />
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
            <span className="export-settings__dimension-label">L</span>
            <input
              type="number"
              value={settings.height}
              onChange={handleHeightChange}
              min={1}
              max={7680}
            />
            <span className="export-settings__dimension-unit">px</span>
          </div>
        </div>
      </div>

      {/* Frame Rate */}
      <div className="export-settings__section">
        <div className="export-settings__label-row">
          <label className="export-settings__label">Cuadros por Segundo</label>
          <span className="export-settings__hint">Original: {originalFps}fps</span>
        </div>
        <div className="export-settings__fps-grid">
          {FPS_OPTIONS.map(fps => (
            <button
              key={fps}
              className={`export-settings__fps-btn ${settings.fps === fps ? 'export-settings__fps-btn--active' : ''} ${settings.format === 'gif' && fps > 30 ? 'export-settings__fps-btn--warning' : ''}`}
              onClick={() => handleFpsChange(fps)}
              title={settings.format === 'gif' && fps > 30 ? 'FPS alto aumenta mucho el peso del GIF' : ''}
            >
              {fps}<span>fps</span>
            </button>
          ))}
        </div>
        {settings.format === 'gif' && settings.fps > 30 && (
          <p className="export-settings__fps-warning">⚠️ Para GIF se recomienda máximo 30fps</p>
        )}
      </div>

      {/* GIF Compression - only for GIF format */}
      {settings.format === 'gif' && (
        <div className="export-settings__section">
          <label className="export-settings__label">Compresión</label>
          <div className="export-settings__compression-grid">
            {GIF_COMPRESSION_PRESETS.map(preset => (
              <button
                key={preset.value}
                className={`export-settings__compression-btn ${gifCompression === preset.value ? 'export-settings__compression-btn--active' : ''}`}
                onClick={() => handleGifCompressionChange(preset.value)}
              >
                <span className="export-settings__compression-label">{preset.label}</span>
                <span className="export-settings__compression-desc">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quality / Bitrate - only for video formats (not GIF / not JSON) */}
      {settings.format !== 'gif' && settings.format !== 'json' && (
        <div className="export-settings__section">
          <label className="export-settings__label">Calidad</label>
          <div className="export-settings__quality-grid">
            {QUALITY_PRESETS.map(quality => (
              <button
                key={quality.value}
                className={`export-settings__quality-btn ${qualityMode === quality.value ? 'export-settings__quality-btn--active' : ''}`}
                onClick={() => handleQualityPreset(quality.value)}
              >
                <span className="export-settings__quality-label">{quality.label}</span>
                <span className="export-settings__quality-desc">{quality.description}</span>
              </button>
            ))}
          </div>
          
          <div className="export-settings__bitrate-row">
            <label className="export-settings__sublabel">Bitrate</label>
            <div className="export-settings__bitrate-input">
              <input
                type="range"
                min={1}
                max={50}
                step={0.5}
                value={settings.bitrate}
                onChange={handleBitrateChange}
              />
              <span className="export-settings__bitrate-value">{settings.bitrate} Mbps</span>
            </div>
          </div>
        </div>
      )}

      {/* Max File Size */}
      <div className="export-settings__section">
        <label className="export-settings__label">Tamaño Máximo (opcional)</label>
        <div className="export-settings__maxsize-input">
          <input
            type="number"
            placeholder="Sin límite"
            value={settings.maxSize ?? ''}
            onChange={handleMaxSizeChange}
            min={0.1}
            step={0.1}
          />
          <span className="export-settings__maxsize-unit">MB</span>
        </div>
        <p className="export-settings__help">Dejá vacío para máxima calidad. Si lo configurás, te avisamos si el archivo es muy grande.</p>
      </div>

      {/* Estimated Output */}
      <div className={`export-settings__estimate ${isHeavyConfig ? 'export-settings__estimate--warning' : ''}`}>
        <div className="export-settings__estimate-row">
          <div className="export-settings__estimate-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 9h6v6H9z"/>
            </svg>
          </div>
          <div className="export-settings__estimate-info">
            <span className="export-settings__estimate-label">Resolución</span>
            <span className="export-settings__estimate-value">{settings.width}×{settings.height}</span>
          </div>
        </div>
        
        <div className="export-settings__estimate-row">
          <div className="export-settings__estimate-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div className="export-settings__estimate-info">
            <span className="export-settings__estimate-label">Peso aproximado</span>
            <span className="export-settings__estimate-value">
              ~{estimatedSizeMin.toFixed(1)} - {estimatedSizeMax.toFixed(1)} MB
            </span>
            <span className="export-settings__estimate-note">Varía según complejidad del contenido</span>
          </div>
        </div>
        
        <div className="export-settings__estimate-summary">
          {settings.format === 'json'
            ? `${settings.fps}fps • hasta ${Math.min(Math.ceil(animDuration * settings.fps), MAX_FRAMES_DEFAULT)} cuadros • Lottie JSON`
            : `${effectiveFps}fps • ${totalFrames} cuadros • ${settings.format.toUpperCase()}`}
        </div>
      </div>

      {/* Tips Section */}
      <div className="export-settings__tips">
        <div className="export-settings__tip export-settings__tip--figma">
          <span className="export-settings__tip-icon">🎨</span>
          <div className="export-settings__tip-content">
            <strong>Para Figma (GIF)</strong>
            <span>720p o menor • 24-30 FPS • Menos de 5MB</span>
          </div>
        </div>
        <div className="export-settings__tip export-settings__tip--slides">
          <span className="export-settings__tip-icon">📊</span>
          <div className="export-settings__tip-content">
            <strong>Para Google Slides</strong>
            <span>GIF: 720p, 24 FPS, &lt;5MB · Video: 1080p, 30 FPS, Alta</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportSettings
