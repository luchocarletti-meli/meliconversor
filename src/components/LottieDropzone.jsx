import { useState, useCallback, useRef } from 'react'
import './LottieDropzone.css'

function LottieDropzone({ onFileLoad }) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    setError(null)
    const name = file.name.toLowerCase()

    if (name.endsWith('.json')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (!data.v || !data.layers || !data.w || !data.h) {
            setError('Este archivo no parece ser una animación Lottie válida')
            return
          }
          onFileLoad(data, file.name)
        } catch {
          setError('Error al leer el archivo JSON')
        }
      }
      reader.onerror = () => setError('Error al leer el archivo')
      reader.readAsText(file)
      return
    }

    if (name.endsWith('.mov') || name.endsWith('.mp4') || name.endsWith('.webm')) {
      const url = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const width = video.videoWidth
        const height = video.videoHeight
        const duration = video.duration
        URL.revokeObjectURL(url)
        if (!width || !height) {
          setError('No se pudo leer el video (dimensiones inválidas)')
          return
        }
        onFileLoad(null, file.name, {
          type: 'video',
          url: URL.createObjectURL(file),
          file,
          width,
          height,
          duration
        })
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        setError('No se pudo cargar el archivo de video')
      }
      video.src = url
      return
    }

    setError('Por favor, subí un archivo .json (Lottie) o video .mov / .mp4 / .webm')
  }, [onFileLoad])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleInputChange = useCallback((e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div 
      className={`dropzone ${isDragging ? 'dropzone--dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".json,.mov,.mp4,.webm"
        onChange={handleInputChange}
        className="dropzone__input"
      />
      
      <div className="dropzone__content">
        <div className="dropzone__icon">
          <svg viewBox="0 0 64 64" fill="none">
            <rect x="8" y="16" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2.5"/>
            <path d="M8 28H56" stroke="currentColor" strokeWidth="2.5"/>
            <circle cx="16" cy="22" r="2" fill="currentColor"/>
            <circle cx="24" cy="22" r="2" fill="currentColor"/>
            <circle cx="32" cy="22" r="2" fill="currentColor"/>
            <path d="M32 36V52M32 36L24 44M32 36L40 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          
          <div className="dropzone__icon-glow" />
        </div>
        
        <h2 className="dropzone__title">Arrastrá tu archivo acá</h2>
        <p className="dropzone__subtitle">o hacé click para buscar</p>
        
        <div className="dropzone__formats">
          <span className="dropzone__format">.json</span>
          <span className="dropzone__format-separator">•</span>
          <span className="dropzone__format">.mov / .mp4 / .webm</span>
          <span className="dropzone__format-separator">•</span>
          <span className="dropzone__format-text">Lottie o video</span>
        </div>
        
        {error && (
          <div className="dropzone__error">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        )}
      </div>
      
      <div className="dropzone__border" />
    </div>
  )
}

export default LottieDropzone
