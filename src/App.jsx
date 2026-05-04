import { useState, useCallback } from 'react'
import LottieDropzone from './components/LottieDropzone'
import LottiePreview from './components/LottiePreview'
import VideoPreview from './components/VideoPreview'
import ExportSettings from './components/ExportSettings'
import ExportProgress from './components/ExportProgress'
import ColorEditor from './components/ColorEditor'
import { useLottieConverter } from './hooks/useLottieConverter'
import { getLottieDataWithoutBackground } from './utils/lottieBackground'
import { getLottieDataWithoutLogo, hasDetectableLogo } from './utils/lottieLogoRemover'
import { applyCrop } from './utils/lottieCrop'
import './App.css'

function App() {
  const [lottieData, setLottieData] = useState(null)
  const [videoSource, setVideoSource] = useState(null)
  const [fileName, setFileName] = useState('')
  const [settings, setSettings] = useState({
    format: 'mp4',
    width: 1080,
    height: 1080,
    fps: 60,
    bitrate: 8,
    maxSize: null,
    quality: 'high',
    gifCompression: 'medium',
    cropBlackBars: 'off',
    transparentBackground: false,
    removeLogo: false
  })

  const {
    isConverting,
    progress,
    progressMessage,
    convert,
    convertVideo,
    exportVideoToLottieJson,
    saveLottieAsJson,
    cancel,
    isLoading: isFFmpegLoading,
    error
  } = useLottieConverter()

  const handleFileLoad = useCallback((data, name, meta) => {
    if (meta?.type === 'video') {
      setLottieData(null)
      setVideoSource(prev => {
        if (prev?.url) URL.revokeObjectURL(prev.url)
        return {
          url: meta.url,
          file: meta.file,
          fileName: name.replace(/\.[^.]+$/, ''),
          displayName: name,
          width: meta.width,
          height: meta.height,
          duration: meta.duration
        }
      })
      setFileName(meta.file.name.replace(/\.[^.]+$/, ''))
      setSettings(prev => ({
        ...prev,
        width: meta.width,
        height: meta.height
      }))
      return
    }
    setVideoSource(null)
    // Limpia automáticamente el watermark al cargar el JSON,
    // sin que el usuario tenga que hacer nada.
    setLottieData(getLottieDataWithoutLogo(data))
    setFileName(name.replace('.json', ''))
    setSettings(prev => {
      const next =
        data?.w && data?.h
          ? { ...prev, width: data.w, height: data.h }
          : { ...prev }
      if (prev.format === 'json') next.format = 'mp4'
      return next
    })
  }, [])

  const handleExport = useCallback(async () => {
    if (videoSource) {
      try {
        if (settings.format === 'json') {
          await exportVideoToLottieJson(videoSource, settings, videoSource.fileName)
        } else {
          await convertVideo(videoSource.file, settings, videoSource.fileName)
        }
      } catch (err) {
        console.error('Error en exportación:', err)
      }
      return
    }
    if (!lottieData) return
    // Guardado directo como JSON (sin FFmpeg)
    if (settings.format === 'json') {
      saveLottieAsJson(lottieData, settings, fileName)
      return
    }
    try {
      await convert(lottieData, settings, fileName)
    } catch (err) {
      console.error('Error en exportación:', err)
    }
  }, [lottieData, videoSource, settings, fileName, convert, convertVideo, exportVideoToLottieJson, saveLottieAsJson])

  const handleClear = useCallback(() => {
    if (videoSource?.url) URL.revokeObjectURL(videoSource.url)
    setVideoSource(null)
    setLottieData(null)
    setFileName('')
  }, [videoSource])

  return (
    <div className="app">
      <div className="app__background">
        <div className="app__gradient-orb app__gradient-orb--1" />
        <div className="app__gradient-orb app__gradient-orb--2" />
        <div className="app__gradient-orb app__gradient-orb--3" />
        <div className="app__grid" />
      </div>
      
      <div className="app__content">
      <header className="app__header">
        <div className="app__header-top">
          <div className="app__logo">
            <svg viewBox="0 0 40 40" fill="none" className="app__logo-icon">
              <rect x="4" y="4" width="32" height="32" rx="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 20L17 25L28 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="32" cy="8" r="6" fill="var(--accent-primary)"/>
              <path d="M30 8H34M32 6V10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h1>Convertidor</h1>
          </div>
        </div>
        <p className="app__tagline">Lottie ↔ video (MOV, MP4, WebM): exportá a MP4, WebM, GIF o Lottie JSON</p>
      </header>

        <main className="app__main">
        {!lottieData && !videoSource ? (
          <LottieDropzone onFileLoad={handleFileLoad} />
        ) : (
          <div className="app__workspace">
            <div className="app__preview-section">
              <div className="app__preview-header">
                <h2>Vista Previa</h2>
                <button className="app__clear-btn" onClick={handleClear}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                  Limpiar
                </button>
              </div>
              {lottieData ? (
                <>
                  <LottiePreview
                    data={(() => {
                      let d = settings.transparentBackground ? getLottieDataWithoutBackground(lottieData) : lottieData
                      if (settings.removeLogo) d = getLottieDataWithoutLogo(d)
                      return d
                    })()}
                    width={settings.width}
                    height={settings.height}
                    onCrop={(crop) => setLottieData(prev => applyCrop(prev, crop))}
                  />
                  <div className="app__file-info">
                    <span className="app__file-name">{fileName}.json</span>
                    <span className="app__file-meta">
                      {lottieData.w}×{lottieData.h} • {lottieData.fr}fps • {((lottieData.op - lottieData.ip) / lottieData.fr).toFixed(2)}s
                    </span>
                  </div>
                  <ColorEditor 
                    data={lottieData} 
                    onDataChange={setLottieData}
                  />
                </>
              ) : (
                <>
                  <VideoPreview 
                    url={videoSource.url} 
                    width={videoSource.width} 
                    height={videoSource.height} 
                    duration={videoSource.duration}
                  />
                  <div className="app__file-info">
                    <span className="app__file-name">{videoSource.displayName}</span>
                    <span className="app__file-meta">
                      {videoSource.width}×{videoSource.height} • {videoSource.duration.toFixed(2)}s
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="app__settings-section">
              <ExportSettings
                settings={settings}
                onChange={setSettings}
                originalWidth={lottieData?.w ?? videoSource?.width}
                originalHeight={lottieData?.h ?? videoSource?.height}
                originalFps={lottieData?.fr ?? 30}
                duration={lottieData ? (lottieData.op - lottieData.ip) / lottieData.fr : (videoSource?.duration ?? 0)}
                isVideoSource={!!videoSource}
                hasDetectableLogo={lottieData ? hasDetectableLogo(lottieData) : false}
              />
              
              {error && (
                <div className="app__error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v4M12 16h.01"/>
                  </svg>
                  {error}
                </div>
              )}

              {isConverting ? (
                <ExportProgress 
                  progress={progress} 
                  message={progressMessage} 
                  onCancel={cancel}
                />
              ) : (
                <button 
                  className="app__export-btn"
                  onClick={handleExport}
                  disabled={
                    /* FFmpeg no hace falta cuando es Lottie + JSON */
                    isFFmpegLoading && !(lottieData && settings.format === 'json')
                  }
                >
                  {isFFmpegLoading && !(lottieData && settings.format === 'json') ? (
                    <>
                      <div className="app__spinner" />
                      Cargando FFmpeg...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Exportar{' '}
                      {settings.format === 'json'
                        ? 'JSON (Lottie)'
                        : settings.format.toUpperCase()}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        </main>

        <footer className="app__footer">
          <p>Desarrollado con FFmpeg.wasm • Sin subidas a servidores</p>
        </footer>
      </div>
    </div>
  )
}

export default App
