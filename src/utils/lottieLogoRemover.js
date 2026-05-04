/**
 * Detects and removes watermark/logo layers from Lottie JSON.
 *
 * Estrategias de detección (en orden de prioridad):
 *
 *   1. Por nombre de capa (nm): regex sobre nombres conocidos
 *   2. Por texto en capa tipo 5: regex sobre contenido de texto
 *   3. Por imagen de watermark (ty2): busca image assets cuya URL contenga
 *      el dominio del watermark (ej: "jitter.video"), luego elimina los
 *      precomps que las contienen
 *   4. Estructural variante A/B: precomp → asset{ty0/ty3/ty4} → asset{ty4}
 *   5. Por posición bottom-right (fallback geométrico)
 */

// Regex para detectar watermarks por nombre de capa
const WATERMARK_NAME_RE = /jitter|watermark|water.?mark|logo.?overlay|brand.?stamp|lottiefiles|haiku\.?design|powered.?by|animaker/i

// Regex para detectar watermarks por dominio/URL (en texto o en image assets)
const WATERMARK_URL_RE = /jitter\.video|lottiefiles\.com|haiku\.design|animaker/i

/**
 * Devuelve true si la capa es un watermark detectable por nombre o texto.
 */
function isNamedWatermarkLayer(layer) {
  if (!layer) return false
  const name = layer.nm || ''
  if (WATERMARK_NAME_RE.test(name)) return true
  // Capas de texto (ty=5): chequeamos el contenido del texto
  if (layer.ty === 5 && layer.t?.d?.k) {
    for (const kf of layer.t.d.k) {
      if (WATERMARK_URL_RE.test(kf?.s?.t || '')) return true
    }
  }
  return false
}

/**
 * Busca image assets (los que tienen p/u pero no layers) cuya URL contiene
 * un dominio de watermark conocido. Devuelve un Set con sus IDs.
 *
 * Ejemplo: asset { id: "0", p: "https://jitter.video/logo.png", ... }
 */
function findWatermarkImageIds(assets) {
  return new Set(
    assets
      .filter(a => !a.layers && (a.p || a.u))
      .filter(a => WATERMARK_URL_RE.test(a.p || '') || WATERMARK_URL_RE.test(a.u || ''))
      .map(a => a.id)
  )
}

/**
 * Dado un set de IDs de imágenes de watermark, encuentra los IDs de assets
 * (precomps) que las contienen directamente con una capa ty2.
 */
function findPrecompsWithWatermarkImages(assets, watermarkImageIds) {
  if (watermarkImageIds.size === 0) return new Set()
  return new Set(
    assets
      .filter(a => Array.isArray(a.layers))
      .filter(a => a.layers.some(l => l.ty === 2 && watermarkImageIds.has(l.refId)))
      .map(a => a.id)
  )
}

/**
 * Detecta el patrón estructural de jitter.video de forma recursiva.
 * Cubre variantes donde el watermark es solo shapes (ty4) sin imágenes.
 *
 * Reglas:
 *   1. El asset DEBE tener al menos un precomp interno (ty0)
 *   2. Todos los layers deben ser ty0, ty3 o ty4
 *   3. Cada precomp interno debe llevar a un asset con SOLO shapes (ty4) o recursivo
 */
function isJitterShapeWatermarkAsset(asset, assetsById, depth = 0) {
  if (!asset?.layers?.length || depth > 4) return false

  const innerPrecomps = asset.layers.filter(l => l.ty === 0)
  if (innerPrecomps.length === 0) return false

  const allAllowed = asset.layers.every(l => l.ty === 0 || l.ty === 3 || l.ty === 4)
  if (!allAllowed) return false

  return innerPrecomps.every(l => {
    const inner = assetsById[l.refId]
    if (!inner?.layers?.length) return false
    return inner.layers.every(il => il.ty === 4) ||
           isJitterShapeWatermarkAsset(inner, assetsById, depth + 1)
  })
}

/**
 * Detecta si una capa precomp está ubicada en la zona bottom-right.
 * Fallback geométrico para casos donde no hay información de nombre/imagen.
 */
function isBottomRightPrecomp(layer, animW, animH) {
  if (layer.ty !== 0 || !animW || !animH) return false
  const pos = layer.ks?.p?.k
  if (!pos) return false

  let x, y
  if (typeof pos[0] === 'number') {
    x = pos[0]; y = pos[1]
  } else if (Array.isArray(pos) && pos[0]?.s) {
    x = pos[0].s[0]; y = pos[0].s[1]
  } else {
    return false
  }

  return x > animW * 0.6 && y > animH * 0.65
}

/**
 * Devuelve una copia del Lottie JSON con las capas de logo/watermark eliminadas.
 */
export function getLottieDataWithoutLogo(data) {
  if (!data) return data
  const copy = JSON.parse(JSON.stringify(data))

  const assetsById = Object.fromEntries((copy.assets || []).map(a => [a.id, a]))
  const allAssets = copy.assets || []

  // DEBUG: mostrar meta y image assets
  console.log('[LogoRemover] meta.g:', copy.meta?.g)
  allAssets.filter(a => !a.layers).forEach(a => {
    console.log(`[LogoRemover] image asset id="${a.id}" p="${a.p?.slice(0,80)}" u="${a.u}"`)
  })
  const animW = copy.w
  const animH = copy.h

  // — Paso 1: IDs de imágenes de watermark (ej: el PNG de jitter.video)
  const watermarkImageIds = findWatermarkImageIds(allAssets)

  // — Paso 2: IDs de precomps que contienen esas imágenes (ej: asset "19")
  const imagePrecompIds = findPrecompsWithWatermarkImages(allAssets, watermarkImageIds)

  // — Paso 3: IDs de assets que son watermarks puro-shapes (variante A/B)
  const shapeWatermarkIds = new Set(
    allAssets
      .filter(a => isJitterShapeWatermarkAsset(a, assetsById))
      .map(a => a.id)
  )

  // — Paso 4: Filtrar top-level layers
  if (Array.isArray(copy.layers)) {
    copy.layers = copy.layers.filter(l => {
      if (isNamedWatermarkLayer(l)) return false
      // Eliminar precomps que contienen imagen de watermark
      if (l.ty === 0 && imagePrecompIds.has(l.refId)) return false
      // Eliminar precomps que son watermarks de shapes
      if (l.ty === 0 && shapeWatermarkIds.has(l.refId)) return false
      // Fallback geométrico
      if (isBottomRightPrecomp(l, animW, animH)) return false
      return true
    })
  }

  // — Paso 5: Limpiar assets internos de capas con nombre de watermark
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
 * Indica si el Lottie contiene algún watermark detectable.
 */
export function hasDetectableLogo(data) {
  if (!data) return false
  const assetsById = Object.fromEntries((data.assets || []).map(a => [a.id, a]))
  const allAssets = data.assets || []
  const animW = data.w
  const animH = data.h

  // Imagen de watermark detectada
  const watermarkImageIds = findWatermarkImageIds(allAssets)
  if (watermarkImageIds.size > 0) return true

  // Capa top-level con nombre/texto/estructura/posición de watermark
  if ((data.layers || []).some(l =>
    isNamedWatermarkLayer(l) ||
    (l.ty === 0 && isJitterShapeWatermarkAsset(assetsById[l.refId], assetsById)) ||
    isBottomRightPrecomp(l, animW, animH)
  )) return true

  // Capa interna con nombre de watermark
  for (const asset of allAssets) {
    if ((asset.layers || []).some(isNamedWatermarkLayer)) return true
  }

  return false
}
