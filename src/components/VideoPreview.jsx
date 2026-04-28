import { useRef, useEffect } from 'react'
import './LottiePreview.css'

function VideoPreview({ url, width, height, duration }) {
  const videoRef = useRef(null)
  const aspectRatio = width && height ? width / height : 1

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  return (
    <div className="lottie-preview">
      <div
        className="lottie-preview__stage"
        style={{ '--aspect-ratio': aspectRatio }}
      >
        <video
          ref={videoRef}
          src={url}
          className="lottie-preview__animation"
          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
          controls
          loop
          muted
          playsInline
        />
      </div>
      <div className="lottie-preview__controls">
        <div className="lottie-preview__progress">
          <div className="lottie-preview__progress-bar" style={{ width: '100%' }} />
        </div>
        <div className="lottie-preview__actions">
          <div className="lottie-preview__frame-counter">
            {width}×{height} • {duration.toFixed(2)}s
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoPreview
