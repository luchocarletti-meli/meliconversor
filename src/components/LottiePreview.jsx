import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import './LottiePreview.css'

function LottiePreview({ data, width, height }) {
  const containerRef = useRef(null)
  const animationRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [speed, setSpeed] = useState(1)
  const playStateRef = useRef(true)
  const speedRef = useRef(1)
  
  // Mantener refs actualizados
  useEffect(() => {
    playStateRef.current = isPlaying
  }, [isPlaying])
  
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  // Re-crear la animación cada vez que data cambie
  useEffect(() => {
    if (!containerRef.current || !data) return

    // Guardar el frame actual antes de destruir
    const savedFrame = animationRef.current ? animationRef.current.currentFrame : 0
    const wasPlaying = playStateRef.current

    // Destroy previous animation
    if (animationRef.current) {
      animationRef.current.destroy()
      animationRef.current = null
    }

    // Crear copia profunda de los datos para evitar problemas de referencia
    const animationData = JSON.parse(JSON.stringify(data))

    // Create new animation
    animationRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: animationData,
    })

    animationRef.current.addEventListener('enterFrame', () => {
      if (animationRef.current) {
        setCurrentFrame(Math.floor(animationRef.current.currentFrame))
      }
    })

    // Restaurar el frame si es un cambio de color (mismo archivo)
    if (savedFrame > 0) {
      animationRef.current.goToAndStop(savedFrame, true)
      if (wasPlaying) {
        animationRef.current.play()
      }
    }

    // Aplicar la velocidad guardada
    animationRef.current.setSpeed(speedRef.current)
    
    if (!wasPlaying) {
      animationRef.current.pause()
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.destroy()
        animationRef.current = null
      }
    }
  }, [data])

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.setSpeed(speed)
    }
  }, [speed])

  const togglePlay = () => {
    if (!animationRef.current) return
    
    if (isPlaying) {
      animationRef.current.pause()
    } else {
      animationRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleRestart = () => {
    if (!animationRef.current) return
    animationRef.current.goToAndPlay(0, true)
    setIsPlaying(true)
  }

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed)
  }

  const totalFrames = data ? data.op - data.ip : 0
  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0

  // Calculate aspect ratio for container
  const aspectRatio = data ? data.w / data.h : 1

  return (
    <div className="lottie-preview">
      <div 
        className="lottie-preview__stage"
        style={{ 
          '--aspect-ratio': aspectRatio
        }}
      >
        <div 
          ref={containerRef} 
          className="lottie-preview__animation"
        />
        
        <div className="lottie-preview__overlay" onClick={togglePlay}>
          <div className={`lottie-preview__play-indicator ${!isPlaying ? 'lottie-preview__play-indicator--visible' : ''}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div className="lottie-preview__controls">
        <div className="lottie-preview__progress">
          <div 
            className="lottie-preview__progress-bar" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="lottie-preview__actions">
          <div className="lottie-preview__left-actions">
            <button 
              className="lottie-preview__btn lottie-preview__btn--primary"
              onClick={togglePlay}
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            
            <button 
              className="lottie-preview__btn"
              onClick={handleRestart}
              title="Reiniciar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 109-9 9 9 0 00-9 9"/>
                <polyline points="3,4 3,9 8,9"/>
              </svg>
            </button>
          </div>
          
          <div className="lottie-preview__frame-counter">
            <span className="lottie-preview__frame-current">{currentFrame}</span>
            <span className="lottie-preview__frame-separator">/</span>
            <span className="lottie-preview__frame-total">{totalFrames}</span>
          </div>
          
          <div className="lottie-preview__speed-controls">
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                className={`lottie-preview__speed-btn ${speed === s ? 'lottie-preview__speed-btn--active' : ''}`}
                onClick={() => handleSpeedChange(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LottiePreview
