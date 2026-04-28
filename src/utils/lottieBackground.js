/**
 * Returns a copy of the Lottie data with solid layers and layers named like
 * "background" / "fondo" / "bg" removed, so the animation can be exported
 * with a transparent background (e.g. GIF/WebM without opaque background).
 * @param {object} data - Lottie animation data
 * @returns {object} New Lottie data (copy) without background layers
 */
export function getLottieDataWithoutBackground(data) {
  if (!data || !Array.isArray(data.layers)) return data
  const copy = JSON.parse(JSON.stringify(data))
  const nameRe = /background|fondo|bg/i
  copy.layers = copy.layers.filter((layer) => {
    if (layer.ty === 1) return false // solid layer (Lottie type 1)
    const name = layer.nm || ''
    if (nameRe.test(name)) return false
    return true
  })
  return copy
}
