import { useEffect, useRef, useState, useCallback } from 'react'
import lottie from 'lottie-web'
import './LottiePreview.css'

// Rect inicial: cubre el 100% de la animación (sin recorte)
const FULL_RECT = { x: 0, y: 0, w: 1, h: 1 }

function LottiePreview({ data, width, height, onCrop }) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const animationRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [speed, setSpeed] = useState(1)
  const playStateRef = useRef(true)
  const speedRef = useRef(1)

  // — Crop state —
  const [cropMode, setCropMode] = useState(false)
  // cropRect en fracción (0–1) del tamaño de la animación
  const [cropRect, setCropRect] = useState(FULL_RECT)
  // dragging = { handle, startX, startY, startRect, stageW, stageH }
  const [dragging, setDragging] = useState(null)

  // Mantener refs actualizados
  useEffect(() => { playStateRef.current = isPlaying }, [isPlaying])
  useEffect(() => { speedRef.current = speed }, [speed])

  // Re-crear la animación cada vez que data cambie
  useEffect(() => {
    if (!containerRef.current || !data) return
    const savedFrame = animationRef.current ? animationRef.current.currentFrame : 0
    const wasPlaying = playStateRef.current

    if (animationRef.current) {
      animationRef.current.destroy()
      animationRef.current = null
    }

    animationRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: JSON.parse(JSON.stringify(data)),
    })

    animationRef.current.addEventListener('enterFrame', () => {
      if (animationRef.current) {
        setCurrentFrame(Math.floor(animationRef.current.currentFrame))
      }
    })

    if (savedFrame > 0) {
      animationRef.current.goToAndStop(savedFrame, true)
      if (wasPlaying) animationRef.current.play()
    }

    animationRef.current.setSpeed(speedRef.current)
    if (!wasPlaying) animationRef.current.pause()

    return () => {
      if (animationRef.current) {
        animationRef.current.destroy()
        animationRef.current = null
      }
    }
  }, [data])

  useEffect(() => {
    if (animationRef.current) animationRef.current.setSpeed(speed)
  }, [speed])

  const togglePlay = () => {
    if (!animationRef.current) return
    if (isPlaying) animationRef.current.pause()
    else animationRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const handleRestart = () => {
    if (!animationRef.current) return
    animationRef.current.goToAndPlay(0, true)
    setIsPlaying(true)
  }

  // ── Crop handlers ──────────────────────────────────────────────

  const handleCropMouseDown = useCallback((e, handle) => {
    e.stopPropagation()
    e.preventDefault()
    const stage = stageRef.current.getBoundingClientRect()
    setDragging({
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...cropRect },
      stageW: stage.width,
      stageH: stage.height,
    })
  }, [cropRect])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const dx = (e.clientX - dragging.startX) / dragging.stageW
    const dy = (e.clientY - dragging.startY) / dragging.stageH
    const r = { ...dragging.startRect }
    const MIN = 0.05

    if (dragging.handle === 'se') {
      r.w = Math.max(MIN, Math.min(1 - r.x, r.w + dx))
      r.h = Math.max(MIN, Math.min(1 - r.y, r.h + dy))
    } else if (dragging.handle === 'sw') {
      const newX = Math.max(0, Math.min(r.x + r.w - MIN, r.x + dx))
      r.w = r.x + r.w - newX
      r.x = newX
      r.h = Math.max(MIN, Math.min(1 - r.y, r.h + dy))
    } else if (dragging.handle === 'ne') {
      r.w = Math.max(MIN, Math.min(1 - r.x, r.w + dx))
      const newY = Math.max(0, Math.min(r.y + r.h - MIN, r.y + dy))
      r.h = r.y + r.h - newY
      r.y = newY
    } else if (dragging.handle === 'nw') {
      const newX = Math.max(0, Math.min(r.x + r.w - MIN, r.x + dx))
      r.w = r.x + r.w - newX
      r.x = newX
      const newY = Math.max(0, Math.min(r.y + r.h - MIN, r.y + dy))
      r.h = r.y + r.h - newY
      r.y = newY
    }

    setCropRect(r)
  }, [dragging])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  const handleApplyCrop = () => {
    if (!onCrop || !data) return
    onCrop({
      x: Math.round(cropRect.x * data.w),
      y: Math.round(cropRect.y * data.h),
      w: Math.round(cropRect.w * data.w),
      h: Math.round(cropRect.h * data.h),
    })
    setCropMode(false)
    setCropRect(FULL_RECT)
  }

  const handleCancelCrop = () => {
    setCropMode(false)
    setCropRect(FULL_RECT)
  }

  // ──────────────────────────────────────────────────────────────

  const totalFrames = data ? data.op - data.ip : 0
  const progress = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0
  const aspectRatio = data ? data.w / data.h : 1

  // Dimensiones del crop en píxeles de animación para mostrar en el label
  const cropPxW = data ? Math.round(cropRect.w * data.w) : 0
  const cropPxH = data ? Math.round(cropRect.h * data.h) : 0

  return (
    <div className="lottie-preview">
      <div
        ref={stageRef}
        className="lottie-preview__stage"
        style={{ '--aspect-ratio': aspectRatio }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Animación */}
        <div ref={containerRef} className="lottie-preview__animation" />

        {/* Overlay de play/pause — oculto en modo crop */}
        {!cropMode && (
          <div className="lottie-preview__overlay" onClick={togglePlay}>
            <div className={`lottie-preview__play-indicator ${!isPlaying ? 'lottie-preview__play-indicator--visible' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        )}

        {/* Overlay de crop */}
        {cropMode && (
          <div className="lottie-preview__crop-overlay">
            {/* Máscaras oscuras fuera del crop */}
            <div className="lottie-preview__crop-mask lottie-preview__crop-mask--top"
              style={{ height: `${cropRect.y * 100}%` }} />
            <div className="lottie-preview__crop-mask lottie-preview__crop-mask--bottom"
              style={{ top: `${(cropRect.y + cropRect.h) * 100}%` }} />
            <div className="lottie-preview__crop-mask lottie-preview__crop-mask--left"
              style={{
                top: `${cropRect.y * 100}%`,
                height: `${cropRect.h * 100}%`,
                width: `${cropRect.x * 100}%`
              }} />
            <div className="lottie-preview__crop-mask lottie-preview__crop-mask--right"
              style={{
                top: `${cropRect.y * 100}%`,
                left: `${(cropRect.x + cropRect.w) * 100}%`,
                height: `${cropRect.h * 100}%`,
              }} />

            {/* Marco del área de crop con handles */}
            <div className="lottie-preview__crop-box"
              style={{
                left: `${cropRect.x * 100}%`,
                top: `${cropRect.y * 100}%`,
                width: `${cropRect.w * 100}%`,
                height: `${cropRect.h * 100}%`,
              }}
            >
              {/* Guías internas (regla de tercios) */}
              <div className="lottie-preview__crop-grid" />

              {/* Handles en las 4 esquinas */}
              {['nw', 'ne', 'sw', 'se'].map(handle => (
                <div
                  key={handle}
                  className={`lottie-preview__crop-handle lottie-preview__crop-handle--${handle}`}
                  onMouseDown={(e) => handleCropMouseDown(e, handle)}
                />
              ))}

              {/* Dimensiones del crop */}
              <div className="lottie-preview__crop-dims">
                {cropPxW} × {cropPxH}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="lottie-preview__controls">
        {cropMode ? (
          // — Modo crop: botones de confirmar / cancelar —
          <div className="lottie-preview__crop-actions">
            <span className="lottie-preview__crop-hint">
              Arrastrá las esquinas para recortar
            </span>
            <div className="lottie-preview__crop-btns">
              <button className="lottie-preview__btn lottie-preview__btn--cancel" onClick={handleCancelCrop}>
                Cancelar
              </button>
              <button className="lottie-preview__btn lottie-preview__btn--apply" onClick={handleApplyCrop}>
                Aplicar crop
              </button>
            </div>
          </div>
        ) : (
          // — Controles normales —
          <>
            <div className="lottie-preview__progress">
              <div className="lottie-preview__progress-bar" style={{ width: `${progress}%` }} />
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

                <button className="lottie-preview__btn" onClick={handleRestart} title="Reiniciar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 109-9 9 9 0 00-9 9"/>
                    <polyline points="3,4 3,9 8,9"/>
                  </svg>
                </button>

                {/* Botón Crop */}
                <button
                  className="lottie-preview__btn lottie-preview__btn--crop"
                  onClick={() => setCropMode(true)}
                  title="Recortar animación"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2v14h14"/>
                    <path d="M2 6h14v14"/>
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
                    onClick={() => setSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default LottiePreview
