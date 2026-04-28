import './ExportProgress.css'

function ExportProgress({ progress, message, onCancel }) {
  const isComplete = progress >= 100
  
  return (
    <div className="export-progress">
      <div className="export-progress__header">
        <div className="export-progress__spinner">
          <svg viewBox="0 0 50 50">
            <circle 
              cx="25" 
              cy="25" 
              r="20" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="4"
              strokeDasharray={Math.PI * 40}
              strokeDashoffset={Math.PI * 40 * (1 - progress / 100)}
              strokeLinecap="round"
              transform="rotate(-90 25 25)"
            />
          </svg>
          <span className="export-progress__percentage">{Math.round(progress)}%</span>
        </div>
        
        <div className="export-progress__info">
          <h3 className="export-progress__title">
            {isComplete ? '¡Listo!' : 'Exportando...'}
          </h3>
          <p className="export-progress__message">{message}</p>
        </div>
      </div>
      
      <div className="export-progress__bar-container">
        <div 
          className="export-progress__bar" 
          style={{ width: `${progress}%` }}
        />
        <div className="export-progress__bar-glow" style={{ left: `${progress}%` }} />
      </div>
      
      <div className="export-progress__steps">
        <div className={`export-progress__step ${progress >= 0 ? 'export-progress__step--active' : ''}`}>
          <div className="export-progress__step-dot" />
          <span>Preparando</span>
        </div>
        <div className={`export-progress__step ${progress >= 30 ? 'export-progress__step--active' : ''}`}>
          <div className="export-progress__step-dot" />
          <span>Renderizando</span>
        </div>
        <div className={`export-progress__step ${progress >= 70 ? 'export-progress__step--active' : ''}`}>
          <div className="export-progress__step-dot" />
          <span>Codificando</span>
        </div>
        <div className={`export-progress__step ${progress >= 100 ? 'export-progress__step--active' : ''}`}>
          <div className="export-progress__step-dot" />
          <span>Listo</span>
        </div>
      </div>
      
      {!isComplete && onCancel && (
        <button 
          className="export-progress__cancel"
          onClick={onCancel}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
          Cancelar
        </button>
      )}
    </div>
  )
}

export default ExportProgress
