/**
 * Aplica un recorte a los datos de un Lottie JSON.
 *
 * crop = { x, y, w, h } en píxeles de animación
 *
 * Qué hace:
 *   1. Cambia copy.w y copy.h a las nuevas dimensiones recortadas
 *   2. Desplaza todas las capas top-level restando el offset (x, y)
 *      para que el contenido aparezca en el lugar correcto
 */

/**
 * Desplaza la posición (ks.p) de una capa por (dx, dy).
 * Soporta posición estática y animada con keyframes.
 */
function shiftLayerPosition(layer, dx, dy) {
  if (!layer.ks?.p) return
  const k = layer.ks.p.k

  if (typeof k[0] === 'number') {
    // Posición estática: [x, y, z]
    layer.ks.p.k[0] += dx
    layer.ks.p.k[1] += dy
  } else if (Array.isArray(k)) {
    // Posición animada: array de keyframes con .s y .e
    for (const kf of k) {
      if (Array.isArray(kf.s)) { kf.s[0] += dx; kf.s[1] += dy }
      if (Array.isArray(kf.e)) { kf.e[0] += dx; kf.e[1] += dy }
    }
  }
}

export function applyCrop(data, crop) {
  if (!data || !crop) return data
  const copy = JSON.parse(JSON.stringify(data))

  // Actualizar dimensiones del canvas
  copy.w = Math.round(crop.w)
  copy.h = Math.round(crop.h)

  // Si el crop no empieza en (0,0), desplazar todas las capas
  if (crop.x !== 0 || crop.y !== 0) {
    for (const layer of (copy.layers || [])) {
      shiftLayerPosition(layer, -crop.x, -crop.y)
    }
  }

  return copy
}
