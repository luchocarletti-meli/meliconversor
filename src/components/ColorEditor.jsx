import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import './ColorEditor.css'

// Convierte color Lottie [r, g, b, a?] (0-1) a hex
function lottieColorToHex(color) {
  if (!color || color.length < 3) return '#000000'
  const r = Math.round(color[0] * 255)
  const g = Math.round(color[1] * 255)
  const b = Math.round(color[2] * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Convierte hex a color Lottie [r, g, b, 1]
function hexToLottieColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b, 1]
}

// Extrae todas las formas (shapes/grupos) con sus colores
function extractShapesWithColors(data) {
  if (!data || typeof data !== 'object') return []
  
  const shapes = []
  let colorIndex = 0
  
  function processShapeGroup(group, layerName, layerIndex, parentPath, parentArray, groupIndexInParent) {
    const groupName = group.nm || 'Grupo'
    const colors = []
    
    // Buscar colores en los items del grupo
    const items = group.it || []
    items.forEach((item, itemIndex) => {
      if (item.ty === 'fl' || item.ty === 'st') {
        const colorData = item.c
        if (colorData?.k && Array.isArray(colorData.k)) {
          if (typeof colorData.k[0] === 'number') {
            colors.push({
              id: `color_${colorIndex++}`,
              hex: lottieColorToHex(colorData.k),
              colorObj: colorData,
              type: item.ty === 'fl' ? 'fill' : 'stroke',
              name: item.nm || (item.ty === 'fl' ? 'Fill' : 'Stroke'),
              animated: false
            })
          } else if (colorData.k[0]?.s) {
            colorData.k.forEach((kf, kfIdx) => {
              if (kf.s) {
                colors.push({
                  id: `color_${colorIndex++}`,
                  hex: lottieColorToHex(kf.s),
                  keyframe: kf,
                  keyType: 's',
                  type: item.ty === 'fl' ? 'fill' : 'stroke',
                  name: `${item.nm || 'Color'} (kf${kfIdx} inicio)`,
                  animated: true
                })
              }
              if (kf.e) {
                colors.push({
                  id: `color_${colorIndex++}`,
                  hex: lottieColorToHex(kf.e),
                  keyframe: kf,
                  keyType: 'e',
                  type: item.ty === 'fl' ? 'fill' : 'stroke',
                  name: `${item.nm || 'Color'} (kf${kfIdx} fin)`,
                  animated: true
                })
              }
            })
          }
        }
      }
    })
    
    if (colors.length > 0) {
      shapes.push({
        id: `shape_${shapes.length}`,
        name: groupName,
        layerName,
        layerIndex,
        colors,
        // Info para poder eliminar este shape
        parentArray,
        indexInParent: groupIndexInParent
      })
    }
    
    // Buscar grupos anidados
    items.forEach((item, idx) => {
      if (item.ty === 'gr') {
        processShapeGroup(item, layerName, layerIndex, `${parentPath}.it[${idx}]`, items, idx)
      }
    })
  }
  
  function processLayer(layer, layerIndex) {
    const layerName = layer.nm || `Capa ${layerIndex + 1}`
    const shapes_arr = layer.shapes || []
    
    shapes_arr.forEach((shape, shapeIndex) => {
      if (shape.ty === 'gr') {
        processShapeGroup(shape, layerName, layerIndex, `layers[${layerIndex}].shapes[${shapeIndex}]`, shapes_arr, shapeIndex)
      }
    })
  }
  
  // Procesar capas principales
  const layers = Array.isArray(data.layers) ? data.layers : []
  layers.forEach((layer, idx) => processLayer(layer, idx))
  
  // Procesar assets (precomposiciones)
  const assets = Array.isArray(data.assets) ? data.assets : []
  assets.forEach((asset, assetIdx) => {
    if (asset.layers) {
      asset.layers.forEach((layer, layerIdx) => {
        const layerName = `${asset.nm || asset.id || 'Asset'} > ${layer.nm || 'Capa'}`
        const shapes_arr = layer.shapes || []
        
        shapes_arr.forEach((shape, shapeIndex) => {
          if (shape.ty === 'gr') {
            processShapeGroup(shape, layerName, layerIdx, `assets[${assetIdx}].layers[${layerIdx}].shapes[${shapeIndex}]`, shapes_arr, shapeIndex)
          }
        })
      })
    }
  })
  
  return shapes
}

// Aplica cambio de color
function applyColorChange(data, shapeId, colorId, newHex) {
  const newData = JSON.parse(JSON.stringify(data))
  const shapes = extractShapesWithColors(newData)
  
  const shape = shapes.find(s => s.id === shapeId)
  if (!shape) return newData
  
  const color = shape.colors.find(c => c.id === colorId)
  if (!color) return newData
  
  const newLottieColor = hexToLottieColor(newHex)
  
  if (color.animated) {
    color.keyframe[color.keyType] = newLottieColor
  } else {
    color.colorObj.k = newLottieColor
  }
  
  return newData
}

// Elimina un shape/grupo
function removeShape(data, shapeInfo) {
  const newData = JSON.parse(JSON.stringify(data))
  const shapes = extractShapesWithColors(newData)
  
  const shape = shapes.find(s => s.id === shapeInfo.id)
  if (!shape || !shape.parentArray) return newData
  
  // Eliminar el shape del array padre
  shape.parentArray.splice(shape.indexInParent, 1)
  
  return newData
}

function ColorEditor({ data, onDataChange }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedShape, setSelectedShape] = useState('all')

  const shapes = useMemo(() => {
    if (!data) return []
    return extractShapesWithColors(data)
  }, [data])

  const allColors = useMemo(() => {
    return shapes.flatMap(s => s.colors.map(c => ({ ...c, shapeName: s.name, shapeId: s.id })))
  }, [shapes])

  const displayedColors = useMemo(() => {
    if (selectedShape === 'all') return allColors
    const shape = shapes.find(s => s.id === selectedShape)
    return shape ? shape.colors.map(c => ({ ...c, shapeName: shape.name, shapeId: shape.id })) : []
  }, [shapes, allColors, selectedShape])

  const handleColorChange = useCallback((shapeId, colorId, newHex) => {
    const newData = applyColorChange(data, shapeId, colorId, newHex)
    onDataChange(newData)
  }, [data, onDataChange])

  const handleRemoveShape = useCallback((shapeId) => {
    const shape = shapes.find(s => s.id === shapeId)
    if (shape && window.confirm(`¿Eliminar "${shape.name}"?`)) {
      const newData = removeShape(data, shape)
      onDataChange(newData)
      setSelectedShape('all')
    }
  }, [data, shapes, onDataChange])

  const selectedShapeInfo = useMemo(() => {
    if (selectedShape === 'all') return null
    return shapes.find(s => s.id === selectedShape)
  }, [shapes, selectedShape])

  if (shapes.length === 0) {
    return (
      <div className="color-editor color-editor--empty">
        <div className="color-editor__header">
          <h3>Editor de Colores</h3>
        </div>
        <p className="color-editor__empty-msg">No se encontraron formas con colores editables.</p>
      </div>
    )
  }

  return (
    <div className="color-editor">
      <div 
        className="color-editor__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="color-editor__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
          </svg>
          <h3>Editor de Colores</h3>
          <span className="color-editor__count">{allColors.length}</span>
        </div>
        <svg 
          className={`color-editor__chevron ${isExpanded ? 'color-editor__chevron--open' : ''}`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {isExpanded && (
        <div className="color-editor__content">
          {/* Selector de shapes */}
          <div className="color-editor__shape-selector">
            <label>Forma:</label>
            <select 
              value={selectedShape} 
              onChange={(e) => setSelectedShape(e.target.value)}
            >
              <option value="all">Todas las formas ({allColors.length} colores)</option>
              {shapes.map((shape) => (
                <option key={shape.id} value={shape.id}>
                  {shape.name} ({shape.colors.length} {shape.colors.length === 1 ? 'color' : 'colores'})
                </option>
              ))}
            </select>
            
            {selectedShape !== 'all' && (
              <button 
                className="color-editor__delete-shape"
                onClick={() => handleRemoveShape(selectedShape)}
                title="Eliminar esta forma"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/>
                </svg>
              </button>
            )}
          </div>

          {/* Tabs de shapes */}
          <div className="color-editor__shape-tabs">
            <button 
              className={`color-editor__shape-tab ${selectedShape === 'all' ? 'color-editor__shape-tab--active' : ''}`}
              onClick={() => setSelectedShape('all')}
            >
              Todas
            </button>
            {shapes.map((shape) => (
              <button 
                key={shape.id}
                className={`color-editor__shape-tab ${selectedShape === shape.id ? 'color-editor__shape-tab--active' : ''}`}
                onClick={() => setSelectedShape(shape.id)}
                title={shape.layerName}
              >
                {shape.name}
                <span className="color-editor__shape-tab-count">{shape.colors.length}</span>
              </button>
            ))}
          </div>

          {/* Info de la forma seleccionada */}
          {selectedShapeInfo && (
            <div className="color-editor__shape-info">
              <span className="color-editor__shape-info-layer">
                En: {selectedShapeInfo.layerName}
              </span>
            </div>
          )}

          {/* Lista de colores */}
          <div className="color-editor__list">
            {displayedColors.map((color) => (
              <ColorItem
                key={color.id}
                color={color}
                showShapeName={selectedShape === 'all'}
                onChange={(newHex) => handleColorChange(color.shapeId, color.id, newHex)}
              />
            ))}
          </div>

          {displayedColors.length === 0 && (
            <p className="color-editor__no-results">
              Esta forma no tiene colores editables
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ColorItem({ color, showShapeName, onChange }) {
  const [localColor, setLocalColor] = useState(color.hex)
  const lastPropHex = useRef(color.hex)
  
  useEffect(() => {
    if (color.hex !== lastPropHex.current) {
      setLocalColor(color.hex)
      lastPropHex.current = color.hex
    }
  }, [color.hex])

  const handleInputChange = (e) => {
    const value = e.target.value
    setLocalColor(value)
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
      lastPropHex.current = value
      onChange(value)
    }
  }

  const handleColorPickerChange = (e) => {
    const value = e.target.value
    setLocalColor(value)
    lastPropHex.current = value
    onChange(value)
  }

  return (
    <div className="color-item">
      <div className="color-item__preview-wrapper">
        <div 
          className="color-item__preview"
          style={{ backgroundColor: localColor }}
        />
        <input
          type="color"
          value={localColor}
          onChange={handleColorPickerChange}
          className="color-item__picker"
        />
      </div>
      
      <div className="color-item__info">
        <span className="color-item__name">{color.name}</span>
        <div className="color-item__meta">
          {showShapeName && (
            <span className="color-item__shape">{color.shapeName}</span>
          )}
          <span className={`color-item__type color-item__type--${color.type}`}>
            {color.type === 'fill' ? 'Relleno' : 'Trazo'}
          </span>
          {color.animated && (
            <span className="color-item__animated">Animado</span>
          )}
        </div>
      </div>

      <div className="color-item__hex-input">
        <input
          type="text"
          value={localColor}
          onChange={handleInputChange}
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

export default ColorEditor
