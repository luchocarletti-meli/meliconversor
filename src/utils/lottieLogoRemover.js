/**
 * Detects and removes watermark/logo layers from Lottie JSON.
 *
 * Jitter.video borra todos los nombres de capas y renderiza el texto del
 * watermark como shapes vectoriales (no como texto). Se detecta por estructura:
 *   top-level precomp → asset con [precomp + null] → asset con [solo shapes]
 *
 * También cubre watermarks con nombres visibles (lottiefiles, haiku, etc.).
 */

// Detección por nombre (para herramientas que no borran el nm)
const WATERMARK_NAME_RE = /jitter|watermark|water.?mark|logo.?overlay|brand.?stamp|lottiefiles|haiku\.?design|powered.?by|animaker/i

// Detección por texto en capas tipo 5
const WATERMARK_TEXT_RE = /jitter\.video|lottiefiles\.com|haiku\.design|animaker/i

/**
 * Devuelve true si la capa es un watermark detectable por nombre o texto.
 */
function isNamedWatermarkLayer(layer) {
  if (!layer) return false
  const name = layer.nm || ''
  if (WATERMARK_NAME_RE.test(name)) return true
  if (layer.ty === 5 && layer.t?.d?.k) {
    for (const kf of layer.t.d.k) {
      if (WATERMARK_TEXT_RE.test(kf?.s?.t || '')) return true
    }
  }
  return false
}

/**
 * Detecta el patrón estructural de jitter.video:
 *   asset contiene SOLO precomps + null layers
 *   y esos precomps internos referencian assets con SOLO shape layers
 *
 * Jitter borra todos los nombres y dibuja el texto como paths vectoriales,
 * por eso la única forma de detectarlo es por la estructura del árbol de assets.
 */
function isJitterWatermarkAsset(asset, assetsById) {
  if (!asset?.layers?.length) return false
  // Todos los layers deben ser precomp (ty=0) o null (ty=3)
  const allPrecompOrNull = asset.layers.every(l => l.ty === 0 || l.ty === 3)
  if (!allPrecompOrNull) return false
  // Debe haber al menos un precomp interno
  const innerPrecomps = asset.layers.filter(l => l.ty === 0)
  if (innerPrecomps.length === 0) return false
  // El precomp interno debe referenciar un asset con SOLO shapes (texto vectorizado)
  return innerPrecomps.some(l => {
    const inner = assetsById[l.refId]
    return inner?.layers?.length > 0 && inner.layers.every(il => il.ty === 4)
  })
}

/**
 * Devuelve una copia del Lottie JSON con las capas de logo/watermark eliminadas.
 * Combina detección por nombre/texto y detección estructural (jitter.video).
 */
export function getLottieDataWithoutLogo(data) {
  if (!data) return data
  const copy = JSON.parse(JSON.stringify(data))

  // Índice de assets por id para búsqueda rápida
  const assetsById = Object.fromEntries((copy.assets || []).map(a => [a.id, a]))

  // IDs de assets que son watermarks por estructura (jitter pattern)
  const watermarkAssetIds = new Set(
    (copy.assets || [])
      .filter(a => isJitterWatermarkAsset(a, assetsById))
      .map(a => a.id)
  )

  // Filtrar top-level layers: por nombre/texto O por referencia a asset watermark
  if (Array.isArray(copy.layers)) {
    copy.layers = copy.layers.filter(l => {
      if (isNamedWatermarkLayer(l)) return false
      if (l.ty === 0 && watermarkAssetIds.has(l.refId)) return false
      return true
    })
  }

  // Filtrar también dentro de precomp assets (por nombre/texto)
  if (Array.isArray(copy.assets)) {
    copy.assets = copy.assets.map(asset => {
      if (!Array.isArray(asset.layers)) return asset
      return {
        ...asset,
        layers: asset.layers.filter(l => !isNamedWatermarkLayer(l))
      }
    })
  }

  return copy
}

/**
 * Indica si el Lottie contiene algún watermark detectable (por nombre o estructura).
 */
export function hasDetectableLogo(data) {
  if (!data) return false
  const assetsById = Object.fromEntries((data.assets || []).map(a => [a.id, a]))
  if ((data.layers || []).some(l =>
    isNamedWatermarkLayer(l) ||
    (l.ty === 0 && isJitterWatermarkAsset(assetsById[l.refId], assetsById))
  )) return true
  for (const asset of (data.assets || [])) {
    if ((asset.layers || []).some(isNamedWatermarkLayer)) return true
  }
  return false
}
