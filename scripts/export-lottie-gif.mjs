/**
 * One-off export: Lottie JSON → animated GIF with solid yellow backdrop (#FFE600).
 * Uses Puppeteer + lottie-web (canvas) + gif-encoder-2.
 *
 * Usage: node scripts/export-lottie-gif.mjs <path-to.json> [output.gif]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import puppeteer from 'puppeteer'
import { createCanvas, Image } from 'canvas'

const require = createRequire(import.meta.url)
const GIFEncoder = require('gif-encoder-2')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')
const lottieScriptPath = path.join(
  projectRoot,
  'node_modules/lottie-web/build/player/lottie_canvas.min.js'
)

/** Matches Lottie fill [1, 0.902, 0] and app theme-color */
const YELLOW_BG = '#FFE600'

async function main() {
  const inputPath = path.resolve(process.argv[2] || '')
  const outArg = process.argv[3]
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error('Usage: node scripts/export-lottie-gif.mjs <animation.json> [out.gif]')
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath, 'utf8')
  const animationData = JSON.parse(raw)
  const w = Math.max(1, Math.round(animationData.w || 512))
  const h = Math.max(1, Math.round(animationData.h || 512))
  const sourceFps = animationData.fr || 60
  const ip = animationData.ip ?? 0
  const op = animationData.op ?? 60
  const totalSourceFrames = Math.max(1, Math.floor(op - ip))

  /** Target GIF fps (smaller file; adjust if you need smoother motion) */
  const outFps = 24
  const durationSec = totalSourceFrames / sourceFps
  const outFrameCount = Math.max(1, Math.ceil(durationSec * outFps))
  /** Evenly sample from first to last frame (inclusive) */
  const timeAt = (i) =>
    outFrameCount === 1 ? 0 : (i / (outFrameCount - 1)) * durationSec

  const defaultOut = path.join(
    path.dirname(inputPath),
    path.basename(inputPath, path.extname(inputPath)) + '.gif'
  )
  const outputPath = path.resolve(outArg || defaultOut)

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: w + 32,
      height: h + 32,
      deviceScaleFactor: 1,
    })

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;background:${YELLOW_BG};">
  <div id="wrap" style="width:${w}px;height:${h}px;background:${YELLOW_BG};overflow:hidden;">
    <div id="lottie" style="width:${w}px;height:${h}px;"></div>
  </div>
</body></html>`

    await page.setContent(html, { waitUntil: 'load' })
    await page.addScriptTag({ path: lottieScriptPath })

    await page.evaluate(
      (data) => {
        window.__lottieReady = false
        window.__lottieErr = null
        try {
          const el = document.getElementById('lottie')
          window.__anim = lottie.loadAnimation({
            container: el,
            renderer: 'canvas',
            loop: false,
            autoplay: false,
            animationData: data,
            rendererSettings: { clearCanvas: true, progressiveLoad: false },
          })
          window.__anim.addEventListener('DOMLoaded', () => {
            window.__lottieReady = true
          })
          window.__anim.addEventListener('data_failed', () => {
            window.__lottieErr = 'data_failed'
          })
        } catch (e) {
          window.__lottieErr = String(e)
        }
      },
      animationData
    )

    await page.waitForFunction(
      () => window.__lottieReady === true || window.__lottieErr,
      { timeout: 60000 }
    )
    const initErr = await page.evaluate(() => window.__lottieErr)
    if (initErr) {
      throw new Error(`Lottie failed to load: ${initErr}`)
    }

    const encoder = new GIFEncoder(w, h, 'octree', true, outFrameCount)
    encoder.start()
    encoder.setRepeat(0)
    encoder.setDelay(Math.round(1000 / outFps))

    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')

    for (let i = 0; i < outFrameCount; i++) {
      const t = timeAt(i)
      const local = Math.min(
        totalSourceFrames - 1,
        Math.floor(t * sourceFps)
      )
      const absoluteFrame = ip + local

      await page.evaluate((frame) => {
        window.__anim.goToAndStop(frame, true)
      }, absoluteFrame)

      const b64 = await page.evaluate(() => {
        const c = document.querySelector('#lottie canvas')
        if (!c) return null
        return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
      })
      if (!b64) {
        throw new Error('No canvas from lottie-web (renderer issue)')
      }

      const pngBuf = Buffer.from(b64, 'base64')
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          ctx.fillStyle = YELLOW_BG
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(img, 0, 0, w, h)
          encoder.addFrame(ctx)
          resolve()
        }
        img.onerror = reject
        img.src = pngBuf
      })

      if ((i + 1) % 20 === 0 || i === outFrameCount - 1) {
        process.stderr.write(`Frame ${i + 1}/${outFrameCount}\n`)
      }
    }

    encoder.finish()
    const out = encoder.out.getData()
    fs.writeFileSync(outputPath, out)
    console.log(`Wrote ${outputPath} (${out.length} bytes, ${w}×${h}, ${outFps} fps)`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
