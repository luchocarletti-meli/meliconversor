import { useState, useCallback, useRef, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import lottie from 'lottie-web'
import { getLottieDataWithoutBackground } from '../utils/lottieBackground'
import { getLottieDataWithoutLogo } from '../utils/lottieLogoRemover'
import {
  captureVideoFramesAsDataUrls,
  captureVideoFramesWithFFmpeg,
  buildLottieFromImageSequence,
  MAX_FRAMES_DEFAULT,
} from '../utils/videoToLottieJson'

export function useLottieConverter() {
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const ffmpegRef = useRef(null)
  const loadedRef = useRef(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const loadFFmpeg = async () => {
      if (loadedRef.current) return
      
      try {
        const ffmpeg = new FFmpeg()
        ffmpegRef.current = ffmpeg
        
        ffmpeg.on('log', ({ message }) => {
          console.log('[FFmpeg]', message)
        })
        
        ffmpeg.on('progress', ({ progress: p }) => {
          const encodingProgress = 70 + (p * 30)
          setProgress(Math.min(encodingProgress, 99))
        })

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
        
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })
        
        loadedRef.current = true
        setIsLoading(false)
      } catch (err) {
        console.error('Error al cargar FFmpeg:', err)
        setError('Error al cargar FFmpeg. Por favor, recargá la página.')
        setIsLoading(false)
      }
    }

    loadFFmpeg()
  }, [])

  // Try to render with a specific renderer
  const tryRenderWithRenderer = useCallback(async (lottieData, settings, onProgress, rendererType) => {
    const { width, height, fps } = settings
    
    // Supersampling: render at higher resolution for better quality
    // Use 1.5x for resolutions above 720p, 2x for 720p and below
    const supersampleFactor = height <= 720 ? 2 : 1.5
    const renderWidth = Math.round(width * supersampleFactor)
    const renderHeight = Math.round(height * supersampleFactor)
    
    const originalFps = lottieData.fr
    const totalOriginalFrames = lottieData.op - lottieData.ip
    const duration = totalOriginalFrames / originalFps
    const totalOutputFrames = Math.ceil(duration * fps)
    
    console.log(`[Render] Trying ${rendererType} renderer: ${totalOutputFrames} frames`)
    console.log(`[Render] Output: ${width}x${height}, Rendering at: ${renderWidth}x${renderHeight} (${supersampleFactor}x supersampling)`)
    
    const frames = []
    
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      left: -99999px;
      top: -99999px;
      width: ${renderWidth}px;
      height: ${renderHeight}px;
      overflow: hidden;
      background: transparent;
    `
    document.body.appendChild(container)
    
    // Render at supersampled resolution
    const canvas = document.createElement('canvas')
    canvas.width = renderWidth
    canvas.height = renderHeight
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    let animation = null
    
    try {
      const rendererSettings = rendererType === 'canvas' 
        ? { clearCanvas: true, progressiveLoad: true }
        : { progressiveLoad: true }
      
      animation = lottie.loadAnimation({
        container,
        renderer: rendererType,
        loop: false,
        autoplay: false,
        animationData: JSON.parse(JSON.stringify(lottieData)),
        rendererSettings
      })
      
      // Wait for animation to load
      await new Promise((resolve, reject) => {
        let resolved = false
        let hasError = false
        
        const onReady = () => {
          if (!resolved) {
            resolved = true
            if (hasError) {
              reject(new Error('Animation had errors during load'))
            } else {
              resolve()
            }
          }
        }
        
        animation.addEventListener('DOMLoaded', onReady)
        animation.addEventListener('data_ready', onReady)
        
        animation.addEventListener('error', (err) => {
          console.warn(`[Render] ${rendererType} animation warning:`, err)
          hasError = true
          // Don't reject immediately, let it try to continue
        })
        
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve() // Continue anyway after timeout
          }
        }, 5000)
      })
      
      console.log(`[Render] ${rendererType} animation loaded, starting frame capture`)
      
      // Capture frames
      for (let i = 0; i < totalOutputFrames; i++) {
        // Check for cancellation
        if (cancelledRef.current) {
          throw new Error('CANCELLED')
        }
        
        const time = i / fps
        const lottieFrame = Math.min(time * originalFps, totalOriginalFrames - 1)
        
        animation.goToAndStop(lottieFrame, true)
        
        // Wait for render
        await new Promise(r => setTimeout(r, 20))
        
        // Get the rendered content at supersampled resolution
        ctx.clearRect(0, 0, renderWidth, renderHeight)
        
        if (rendererType === 'canvas') {
          const lottieCanvas = container.querySelector('canvas')
          if (lottieCanvas) {
            ctx.drawImage(lottieCanvas, 0, 0, lottieCanvas.width, lottieCanvas.height, 0, 0, renderWidth, renderHeight)
          }
        } else {
          // SVG renderer
          const svgElement = container.querySelector('svg')
          if (svgElement) {
            svgElement.setAttribute('width', String(renderWidth))
            svgElement.setAttribute('height', String(renderHeight))
            
            const svgClone = svgElement.cloneNode(true)
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
            svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
            
            const svgData = new XMLSerializer().serializeToString(svgClone)
            const svgBase64 = btoa(unescape(encodeURIComponent(svgData)))
            const svgUrl = `data:image/svg+xml;base64,${svgBase64}`
            
            const img = new Image()
            await new Promise((resolve) => {
              img.onload = resolve
              img.onerror = resolve // Continue even on error
              img.src = svgUrl
            })
            
            if (img.complete && img.naturalWidth > 0) {
              ctx.drawImage(img, 0, 0, renderWidth, renderHeight)
            }
          }
        }
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0))
        frames.push(blob)
        
        onProgress(i + 1, totalOutputFrames)
        
        if (i % Math.ceil(totalOutputFrames / 10) === 0) {
          console.log(`[Render] ${rendererType}: ${Math.round((i / totalOutputFrames) * 100)}%`)
        }
      }
      
      console.log(`[Render] ${rendererType} complete: ${frames.length} frames`)
      return frames
      
    } finally {
      if (animation) {
        try { animation.destroy() } catch { /* ignore */ }
      }
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
    }
  }, [])

  const renderLottieFrames = useCallback(async (lottieData, settings, onProgress) => {
    // Try canvas first, then fall back to SVG
    const renderers = ['canvas', 'svg']
    
    for (const renderer of renderers) {
      try {
        console.log(`[Render] Attempting ${renderer} renderer...`)
        const frames = await tryRenderWithRenderer(lottieData, settings, onProgress, renderer)
        
        // Validate frames
        const validFrames = frames.filter(f => f && f.size > 500)
        const validRatio = validFrames.length / frames.length
        
        console.log(`[Render] ${renderer} validation: ${validFrames.length}/${frames.length} valid (${Math.round(validRatio * 100)}%)`)
        
        if (validRatio >= 0.8) {
          return frames
        } else {
          console.warn(`[Render] ${renderer} produced too many invalid frames, trying next renderer...`)
        }
      } catch (err) {
        console.warn(`[Render] ${renderer} failed:`, err.message)
      }
    }
    
    throw new Error('No se pudo renderizar la animación con ningún método')
  }, [tryRenderWithRenderer])

  const convert = useCallback(async (lottieData, settings, fileName) => {
    if (!ffmpegRef.current || !loadedRef.current) {
      setError('FFmpeg no está cargado todavía')
      return
    }

    setIsConverting(true)
    setProgress(0)
    setProgressMessage('Preparando animación...')
    setError(null)
    cancelledRef.current = false

    const ffmpeg = ffmpegRef.current

    try {
      setProgressMessage('Renderizando cuadros...')
      console.log('[Convert] Starting render phase')
      
      let dataToRender = settings.transparentBackground
        ? getLottieDataWithoutBackground(lottieData)
        : lottieData
      if (settings.transparentBackground) {
        console.log('[Convert] Transparent background: removed solid/background layers')
      }
      if (settings.removeLogo) {
        dataToRender = getLottieDataWithoutLogo(dataToRender)
        console.log('[Convert] Remove logo: filtered watermark layers')
      }
      
      const frames = await renderLottieFrames(dataToRender, settings, (current, total) => {
        const renderProgress = (current / total) * 65
        setProgress(renderProgress)
        setProgressMessage(`Renderizando cuadro ${current}/${total}`)
      })
      
      if (frames.length === 0) {
        throw new Error('No se pudieron renderizar los cuadros')
      }
      
      setProgressMessage('Procesando cuadros...')
      setProgress(65)
      
      for (let i = 0; i < frames.length; i++) {
        const frameData = await frames[i].arrayBuffer()
        const paddedIndex = String(i).padStart(6, '0')
        await ffmpeg.writeFile(`frame_${paddedIndex}.png`, new Uint8Array(frameData))
      }
      
      setProgressMessage('Codificando video...')
      setProgress(70)
      
      const { format, fps, bitrate, maxSize, width, height } = settings
      const outputFileName = `${fileName}.${format}`
      
      let ffmpegArgs = []
      
      // Ensure even dimensions for video encoding
      const evenWidth = width % 2 === 0 ? width : width - 1
      const evenHeight = height % 2 === 0 ? height : height - 1
      
      if (format === 'gif') {
        const gifFps = Math.min(fps, 30)
        const gifCompression = settings.gifCompression || 'medium'
        const transparent = !!settings.transparentBackground
        const compressionConfig = {
          low: { colors: transparent ? 255 : 256, dither: 'sierra2_4a', lossy: 0 },
          medium: { colors: transparent ? 127 : 128, dither: 'sierra2_4a', lossy: 20 },
          high: { colors: transparent ? 63 : 64, dither: 'bayer:bayer_scale=3', lossy: 40 }
        }
        const config = compressionConfig[gifCompression]
        
        console.log(`[Convert] GIF compression: ${gifCompression} (${config.colors} colors), transparent: ${transparent}`)
        
        const scaleFilter = `fps=${gifFps},scale=${evenWidth}:${evenHeight}:flags=lanczos`
        const paletteGenOpts = `palettegen=max_colors=${config.colors}:stats_mode=diff${transparent ? ':reserve_transparent=on' : ''}`
        await ffmpeg.exec([
          '-framerate', String(fps),
          '-i', 'frame_%06d.png',
          '-vf', `${scaleFilter},${paletteGenOpts}`,
          '-y', 'palette.png'
        ])
        
        const paletteUseOpts = `dither=${config.dither}:diff_mode=rectangle${transparent ? ':alpha_threshold=128' : ''}`
        ffmpegArgs = [
          '-framerate', String(fps),
          '-i', 'frame_%06d.png',
          '-i', 'palette.png',
          '-lavfi', `${scaleFilter}[x];[x][1:v]paletteuse=${paletteUseOpts}`,
          '-y', outputFileName
        ]
      } else if (format === 'webm') {
        // Scale from supersampled to target with bicubic for smooth result
        ffmpegArgs = [
          '-framerate', String(fps),
          '-i', 'frame_%06d.png',
          '-vf', `scale=${evenWidth}:${evenHeight}:flags=bicubic`,
          '-c:v', 'libvpx-vp9',
          '-b:v', `${bitrate}M`,
          '-crf', '15',
          '-pix_fmt', 'yuva420p',
          '-auto-alt-ref', '0',
          '-y', outputFileName
        ]
      } else {
        // MP4 - scale from supersampled frames with high quality settings
        const crf = bitrate >= 15 ? 10 : bitrate >= 8 ? 14 : 18
        
        ffmpegArgs = [
          '-framerate', String(fps),
          '-i', 'frame_%06d.png',
          '-vf', `scale=${evenWidth}:${evenHeight}:flags=lanczos`,
          '-c:v', 'libx264',
          '-preset', 'slow', // Better quality, slightly slower
          '-crf', String(crf),
          '-tune', 'animation', // Optimized for animated content
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-y', outputFileName
        ]
      }
      
      console.log('[Convert] FFmpeg args:', ffmpegArgs.join(' '))
      await ffmpeg.exec(ffmpegArgs)
      
      setProgressMessage('Finalizando...')
      setProgress(95)
      
      let data
      try {
        data = await ffmpeg.readFile(outputFileName)
        console.log(`[Convert] Output file size: ${data.length} bytes`)
      } catch {
        throw new Error('FFmpeg no generó el archivo de salida')
      }
      
      if (data.length < 5000) {
        throw new Error(`El archivo de salida es muy pequeño (${data.length} bytes). Los frames pueden estar vacíos.`)
      }
      
      // Cleanup
      for (let i = 0; i < frames.length; i++) {
        try {
          await ffmpeg.deleteFile(`frame_${String(i).padStart(6, '0')}.png`)
        } catch { /* ignore */ }
      }
      if (format === 'gif') {
        try { await ffmpeg.deleteFile('palette.png') } catch { /* ignore */ }
      }
      try { await ffmpeg.deleteFile(outputFileName) } catch { /* ignore */ }
      
      const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif' }
      const blob = new Blob([data.buffer], { type: mimeTypes[format] })
      
      if (maxSize && blob.size > maxSize * 1024 * 1024) {
        setError(`El archivo (${(blob.size / 1024 / 1024).toFixed(1)}MB) supera el máximo (${maxSize}MB).`)
        setIsConverting(false)
        return
      }
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = outputFileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      setProgress(100)
      setProgressMessage('¡Listo!')
      
      setTimeout(() => {
        setIsConverting(false)
        setProgress(0)
        setProgressMessage('')
      }, 1500)
      
    } catch (err) {
      console.error('Error de conversión:', err)
      
      // Don't show error for cancellation
      if (err.message === 'CANCELLED') {
        setProgressMessage('Cancelado')
        setTimeout(() => {
          setIsConverting(false)
          setProgress(0)
          setProgressMessage('')
        }, 500)
        return
      }
      
      setError(`Error en la conversión: ${err.message || 'Error desconocido'}`)
      setIsConverting(false)
    }
  }, [renderLottieFrames])

  const convertVideo = useCallback(async (videoFile, settings, fileName) => {
    if (!ffmpegRef.current || !loadedRef.current) {
      setError('FFmpeg no está cargado todavía')
      return
    }

    setIsConverting(true)
    setProgress(0)
    setProgressMessage('Preparando video...')
    setError(null)
    cancelledRef.current = false

    const ffmpeg = ffmpegRef.current
    const lower = videoFile.name.toLowerCase()
    const ext = lower.endsWith('.webm')
      ? 'webm'
      : lower.endsWith('.mov')
        ? 'mov'
        : 'mp4'
    const inputName = `input.${ext}`

    const parseCropDetectLog = (logs) => {
      const re = /crop=(\d+):(\d+):(\d+):(\d+)/
      let lastMatch = null
      for (const msg of logs) {
        const m = String(msg).match(re)
        if (m) lastMatch = { w: parseInt(m[1], 10), h: parseInt(m[2], 10), x: parseInt(m[3], 10), y: parseInt(m[4], 10) }
      }
      return lastMatch
    }

    try {
      setProgressMessage('Cargando archivo...')
      const buffer = await videoFile.arrayBuffer()
      await ffmpeg.writeFile(inputName, new Uint8Array(buffer))
      setProgress(20)

      const { format, fps, bitrate, maxSize, width, height } = settings
      const outputFileName = `${fileName}.${format}`
      const evenWidth = width % 2 === 0 ? width : width - 1
      const evenHeight = height % 2 === 0 ? height : height - 1

      let cropFilter = ''
      if (settings.cropBlackBars === 'auto') {
        setProgressMessage('Detectando barras negras...')
        const cropLogs = []
        const onLog = ({ message }) => cropLogs.push(message)
        ffmpeg.on('log', onLog)
        try {
          await ffmpeg.exec([
            '-i', inputName,
            '-vf', 'cropdetect=24:2:0',
            '-f', 'null', '-'
          ])
        } catch (e) {
          console.warn('[FFmpeg] cropdetect pass failed, continuing without crop:', e)
        }
        ffmpeg.off('log', onLog)
        const crop = parseCropDetectLog(cropLogs)
        if (crop && crop.w > 0 && crop.h > 0) {
          cropFilter = `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},`
          console.log('[FFmpeg] Crop black bars:', crop)
        }
        if (cancelledRef.current) throw new Error('CANCELLED')
      }

      let ffmpegArgs = []

      if (format === 'gif') {
        const gifFps = Math.min(fps, 30)
        const gifCompression = settings.gifCompression || 'medium'
        const compressionConfig = {
          low: { colors: 256, dither: 'sierra2_4a', lossy: 0 },
          medium: { colors: 128, dither: 'sierra2_4a', lossy: 20 },
          high: { colors: 64, dither: 'bayer:bayer_scale=3', lossy: 40 }
        }
        const config = compressionConfig[gifCompression]

        await ffmpeg.exec([
          '-i', inputName,
          '-vf', `${cropFilter}fps=${gifFps},scale=${evenWidth}:${evenHeight}:flags=lanczos,palettegen=max_colors=${config.colors}:stats_mode=diff`,
          '-y', 'palette.png'
        ])
        if (cancelledRef.current) throw new Error('CANCELLED')
        setProgress(50)

        ffmpegArgs = [
          '-i', inputName,
          '-i', 'palette.png',
          '-lavfi', `${cropFilter}fps=${gifFps},scale=${evenWidth}:${evenHeight}:flags=lanczos[x];[x][1:v]paletteuse=dither=${config.dither}:diff_mode=rectangle`,
          '-y', outputFileName
        ]
      } else if (format === 'webm') {
        ffmpegArgs = [
          '-i', inputName,
          '-vf', `${cropFilter}scale=${evenWidth}:${evenHeight}:flags=bicubic,fps=${fps}`,
          '-c:v', 'libvpx-vp9',
          '-b:v', `${bitrate}M`,
          '-crf', '15',
          '-pix_fmt', 'yuva420p',
          '-auto-alt-ref', '0',
          '-y', outputFileName
        ]
      } else {
        const crf = bitrate >= 15 ? 10 : bitrate >= 8 ? 14 : 18
        ffmpegArgs = [
          '-i', inputName,
          '-vf', `${cropFilter}scale=${evenWidth}:${evenHeight}:flags=lanczos,fps=${fps}`,
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', String(crf),
          '-tune', 'animation',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-y', outputFileName
        ]
      }

      setProgressMessage('Codificando...')
      await ffmpeg.exec(ffmpegArgs)
      if (cancelledRef.current) throw new Error('CANCELLED')

      setProgressMessage('Finalizando...')
      setProgress(95)

      let data
      try {
        data = await ffmpeg.readFile(outputFileName)
      } catch {
        throw new Error('FFmpeg no generó el archivo de salida')
      }

      try { await ffmpeg.deleteFile(inputName) } catch { /* ignore */ }
      if (format === 'gif') {
        try { await ffmpeg.deleteFile('palette.png') } catch { /* ignore */ }
      }
      try { await ffmpeg.deleteFile(outputFileName) } catch { /* ignore */ }

      const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif' }
      const blob = new Blob([data.buffer], { type: mimeTypes[format] })

      if (maxSize && blob.size > maxSize * 1024 * 1024) {
        setError(`El archivo (${(blob.size / 1024 / 1024).toFixed(1)}MB) supera el máximo (${maxSize}MB).`)
        setIsConverting(false)
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = outputFileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setProgress(100)
      setProgressMessage('¡Listo!')
      setTimeout(() => {
        setIsConverting(false)
        setProgress(0)
        setProgressMessage('')
      }, 1500)
    } catch (err) {
      console.error('Error conversión video:', err)
      try { await ffmpeg.deleteFile(inputName) } catch { /* ignore */ }
      if (err.message === 'CANCELLED') {
        setProgressMessage('Cancelado')
        setTimeout(() => {
          setIsConverting(false)
          setProgress(0)
          setProgressMessage('')
        }, 500)
        return
      }
      setError(`Error en la conversión: ${err.message || 'Error desconocido'}`)
      setIsConverting(false)
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setProgressMessage('Cancelando...')
  }, [])

  /**
   * Video (.mov / .webm / .mp4) → Lottie JSON (una imagen JPEG por cuadro).
   * Intenta primero el decode del navegador; si falla, FFmpeg (mismos códecs que MP4/GIF/WebM).
   */
  const exportVideoToLottieJson = useCallback(
    async (videoSource, settings, fileName) => {
      setIsConverting(true)
      setProgress(0)
      setProgressMessage('Extrayendo cuadros del video...')
      setError(null)
      cancelledRef.current = false

      const { width, height, fps } = settings
      const evenWidth = width % 2 === 0 ? width : width - 1
      const evenHeight = height % 2 === 0 ? height : height - 1

      try {
        let frames
        try {
          frames = await captureVideoFramesAsDataUrls(
            videoSource.url,
            evenWidth,
            evenHeight,
            fps,
            videoSource.duration,
            (current, total) => {
              setProgress((current / total) * 92)
              setProgressMessage(`Cuadro ${current} / ${total}`)
            },
            {
              cancelled: () => cancelledRef.current,
              maxFrames: MAX_FRAMES_DEFAULT,
            }
          )
        } catch (browserErr) {
          if (browserErr.message === 'CANCELLED') throw browserErr
          console.warn('[Lottie JSON] Captura en navegador falló, usando FFmpeg:', browserErr)

          if (!loadedRef.current || !ffmpegRef.current) {
            setProgressMessage('Esperando FFmpeg para decodificar el video...')
            for (let w = 0; w < 180; w += 1) {
              if (cancelledRef.current) throw new Error('CANCELLED')
              if (loadedRef.current && ffmpegRef.current) break
              await new Promise((r) => setTimeout(r, 500))
            }
          }

          if (!loadedRef.current || !ffmpegRef.current) {
            throw new Error(
              'El navegador no pudo abrir este video y FFmpeg no terminó de cargar. Esperá unos segundos y volvé a intentar, o convertí antes a MP4 y cargá ese archivo.'
            )
          }

          setProgressMessage('Extrayendo cuadros con FFmpeg...')
          setProgress(5)
          frames = await captureVideoFramesWithFFmpeg(
            ffmpegRef.current,
            videoSource.file,
            evenWidth,
            evenHeight,
            fps,
            MAX_FRAMES_DEFAULT,
            (current, total) => {
              setProgress(5 + (current / total) * 87)
              setProgressMessage(`FFmpeg: cuadro ${current} / ${total}`)
            },
            { cancelled: () => cancelledRef.current }
          )
        }

        if (cancelledRef.current) throw new Error('CANCELLED')

        setProgressMessage('Generando JSON Lottie...')
        setProgress(94)

        const lottie = buildLottieFromImageSequence(
          frames,
          evenWidth,
          evenHeight,
          fps,
          videoSource.displayName || fileName
        )

        const jsonStr = JSON.stringify(lottie)
        const blob = new Blob([jsonStr], { type: 'application/json' })

        const maxSize = settings.maxSize
        if (maxSize && blob.size > maxSize * 1024 * 1024) {
          setError(
            `El JSON (${(blob.size / 1024 / 1024).toFixed(1)}MB) supera el máximo (${maxSize}MB). Bajá FPS, resolución o duración.`
          )
          setIsConverting(false)
          return
        }

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${fileName || 'video'}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        setProgress(100)
        setProgressMessage('¡Listo!')
        setTimeout(() => {
          setIsConverting(false)
          setProgress(0)
          setProgressMessage('')
        }, 1500)
      } catch (err) {
        console.error('Error exportando video a Lottie JSON:', err)
        if (err.message === 'CANCELLED') {
          setProgressMessage('Cancelado')
          setTimeout(() => {
            setIsConverting(false)
            setProgress(0)
            setProgressMessage('')
          }, 500)
          return
        }
        setError(err.message || 'No se pudo generar el JSON')
        setIsConverting(false)
      }
    },
    []
  )

  /**
   * Lottie JSON → descarga directa del JSON transformado (sin FFmpeg).
   * Aplica las mismas transformaciones que el render (fondo transparente, logo, etc.).
   */
  const saveLottieAsJson = useCallback(
    (lottieData, settings, fileName) => {
      let data = settings.transparentBackground
        ? getLottieDataWithoutBackground(lottieData)
        : lottieData
      if (settings.removeLogo) {
        data = getLottieDataWithoutLogo(data)
      }
      const jsonStr = JSON.stringify(data)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileName || 'animation'}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
    []
  )

  return {
    isConverting,
    progress,
    progressMessage,
    isLoading,
    error,
    convert,
    convertVideo,
    exportVideoToLottieJson,
    saveLottieAsJson,
    cancel,
  }
}
