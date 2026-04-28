/**
 * Captures frames from a video (blob URL) and builds a Lottie JSON
 * with one image layer per frame (image sequence). Compatible with lottie-web.
 */

const MAX_FRAMES_DEFAULT = 900

/**
 * Espera a que el elemento video tenga datos decodificables (sin crossOrigin en blob: suele romper la carga).
 */
function waitForVideoElementReady(video, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('El video tardó demasiado en cargar'))
    }, timeoutMs)

    const cleanup = () => {
      clearTimeout(timer)
      video.removeEventListener('loadeddata', onReady)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onErr)
    }

    const tryResolve = () => {
      if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA — hay al menos un frame para drawImage
        cleanup()
        resolve()
      }
    }

    const onReady = () => tryResolve()

    const onMeta = () => {
      // Metadatos listos; en algunos codecs hace falta un frame más
      tryResolve()
    }

    const onErr = () => {
      cleanup()
      reject(new Error('No se pudo cargar el video para exportar'))
    }

    video.addEventListener('loadeddata', onReady)
    video.addEventListener('canplay', onReady)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('error', onErr)

    tryResolve()
    // No llamar load() de más: con blob URL puede reiniciar el buffer y retrasar o duplicar eventos.
  })
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const t = Math.max(0, time)
    if (Math.abs(video.currentTime - t) < 1 / 120) {
      requestAnimationFrame(() => resolve())
      return
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = t
  })
}

/**
 * @param {string} videoUrl - object URL
 * @param {number} width
 * @param {number} height
 * @param {number} fps
 * @param {number} duration - seconds
 * @param {(current: number, total: number) => void} onProgress
 * @param {{ cancelled?: () => boolean }} opts
 * @returns {Promise<string[]>} JPEG data URLs (data:image/jpeg;base64,...)
 */
export async function captureVideoFramesAsDataUrls(
  videoUrl,
  width,
  height,
  fps,
  duration,
  onProgress,
  opts = {}
) {
  const { cancelled = () => false, maxFrames = MAX_FRAMES_DEFAULT } = opts
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.preload = 'auto'
  // No usar crossOrigin con blob: — en Chrome/Safari suele disparar error y falla la carga.
  video.src = videoUrl

  await waitForVideoElementReady(video)

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : video.duration || 0
  if (safeDuration <= 0) {
    video.removeAttribute('src')
    throw new Error('Duración de video inválida')
  }

  let totalFrames = Math.ceil(safeDuration * fps)
  if (totalFrames < 1) totalFrames = 1
  if (totalFrames > maxFrames) totalFrames = maxFrames

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const dataUrls = []
  const dt = safeDuration / totalFrames

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (cancelled()) throw new Error('CANCELLED')
      const t = i === totalFrames - 1 ? Math.max(0, safeDuration - 1 / fps) : i * dt
      await seekVideo(video, t)
      if (cancelled()) throw new Error('CANCELLED')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      dataUrls.push(canvas.toDataURL('image/jpeg', 0.85))
      onProgress?.(i + 1, totalFrames)
    }
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }

  return dataUrls
}

/**
 * @param {string[]} frameDataUrls - data:image/jpeg;base64,...
 * @param {number} width - comp width
 * @param {number} height - comp height
 * @param {number} fps
 * @param {string} name - composition name
 */
export function buildLottieFromImageSequence(frameDataUrls, width, height, fps, name = 'Video → Lottie') {
  const w = Math.round(width)
  const h = Math.round(height)
  const fr = Math.min(120, Math.max(1, fps))
  const n = frameDataUrls.length
  const op = n

  const assets = frameDataUrls.map((dataUrl, i) => ({
    id: `vid_frame_${i}`,
    w,
    h,
    u: '',
    p: dataUrl,
    e: 1,
  }))

  const layers = frameDataUrls.map((_, i) => ({
    ddd: 0,
    ind: n - i,
    ty: 2,
    nm: `Frame ${i + 1}`,
    refId: `vid_frame_${i}`,
    sr: 1,
    ks: {
      o: { a: 0, k: 100, ix: 11 },
      r: { a: 0, k: 0, ix: 10 },
      p: { a: 0, k: [w / 2, h / 2, 0], ix: 2 },
      a: { a: 0, k: [w / 2, h / 2, 0], ix: 1 },
      s: { a: 0, k: [100, 100, 100], ix: 6 },
    },
    ao: 0,
    ip: i,
    op: i + 1,
    st: 0,
    bm: 0,
  }))

  return {
    v: '5.7.4',
    fr,
    ip: 0,
    op,
    w,
    h,
    nm: name,
    ddd: 0,
    assets,
    layers,
    markers: [],
  }
}

async function pngBytesToJpegDataUrl(bytes, quality = 0.85) {
  const blob = new Blob([bytes], { type: 'image/png' })
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      return canvas.toDataURL('image/jpeg', quality)
    } finally {
      bitmap.close?.()
    }
  }
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } finally {
        URL.revokeObjectURL(u)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(u)
      reject(new Error('No se pudo decodificar un cuadro'))
    }
    img.src = u
  })
}

/**
 * Extrae cuadros con FFmpeg (mismos códecs que el resto de exportaciones).
 * Útil cuando el decode del navegador falla (p. ej. algunos .mov / HEVC).
 */
export async function captureVideoFramesWithFFmpeg(
  ffmpeg,
  videoFile,
  width,
  height,
  fps,
  maxFrames,
  onProgress,
  opts = {}
) {
  const { cancelled = () => false } = opts
  const lower = videoFile.name.toLowerCase()
  const ext = lower.endsWith('.webm')
    ? 'webm'
    : lower.endsWith('.mov')
      ? 'mov'
      : 'mp4'
  const inputName = `ljf_in.${ext}`

  for (let i = 1; i <= maxFrames; i += 1) {
    const fn = `ljf_${String(i).padStart(6, '0')}.png`
    try {
      await ffmpeg.deleteFile(fn)
    } catch {
      /* ignore */
    }
  }
  try {
    await ffmpeg.deleteFile(inputName)
  } catch {
    /* ignore */
  }

  const buffer = await videoFile.arrayBuffer()
  await ffmpeg.writeFile(inputName, new Uint8Array(buffer))

  if (cancelled()) throw new Error('CANCELLED')

  await ffmpeg.exec([
    '-i',
    inputName,
    '-vf',
    `scale=${width}:${height}:flags=lanczos,fps=${fps}`,
    '-frames:v',
    String(maxFrames),
    '-y',
    'ljf_%06d.png',
  ])

  const dataUrls = []
  for (let i = 1; i <= maxFrames; i += 1) {
    if (cancelled()) throw new Error('CANCELLED')
    const fn = `ljf_${String(i).padStart(6, '0')}.png`
    let data
    try {
      data = await ffmpeg.readFile(fn)
    } catch {
      break
    }
    const raw = data instanceof Uint8Array ? data : new Uint8Array(data)
    if (raw.length < 50) break

    const dataUrl = await pngBytesToJpegDataUrl(raw, 0.85)
    dataUrls.push(dataUrl)

    try {
      await ffmpeg.deleteFile(fn)
    } catch {
      /* ignore */
    }
    onProgress?.(dataUrls.length, maxFrames)
  }

  try {
    await ffmpeg.deleteFile(inputName)
  } catch {
    /* ignore */
  }

  if (dataUrls.length === 0) {
    throw new Error('FFmpeg no pudo extraer cuadros de este video')
  }

  return dataUrls
}

export { MAX_FRAMES_DEFAULT }
