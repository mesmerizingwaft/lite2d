import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

type ColorStats = {
  pixels: number
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
}

type SpriteSheetStats = {
  width: number
  height: number
  frames: {
    base: ColorStats
    object: ColorStats
    whitePixels: number
  }[]
}

async function readSpriteSheetStats(page: import('@playwright/test').Page, pngPath: string): Promise<SpriteSheetStats> {
  const png = await fs.readFile(pngPath)
  return page.evaluate(async base64 => {
    const image = new Image()
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to load exported spritesheet PNG'))
    })
    image.src = `data:image/png;base64,${base64}`
    await imageLoaded

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D canvas context')
    ctx.drawImage(image, 0, 0)

    const colorStats = (frameIndex: number, target: [number, number, number]): ColorStats => {
      const frameWidth = 512
      const frameHeight = 512
      const columns = 6
      const startX = (frameIndex % columns) * frameWidth
      const startY = Math.floor(frameIndex / columns) * frameHeight
      const data = ctx.getImageData(startX, startY, frameWidth, frameHeight).data
      let pixels = 0
      let minX = frameWidth
      let minY = frameHeight
      let maxX = -1
      let maxY = -1

      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          const i = (y * frameWidth + x) * 4
          const distance = Math.abs(data[i] - target[0]) + Math.abs(data[i + 1] - target[1]) + Math.abs(data[i + 2] - target[2])
          if (distance <= 24 && data[i + 3] > 180) {
            pixels += 1
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      return { pixels, bbox: pixels ? { minX, minY, maxX, maxY } : null }
    }

    const whitePixels = (frameIndex: number) => {
      const frameWidth = 512
      const frameHeight = 512
      const columns = 6
      const startX = (frameIndex % columns) * frameWidth
      const startY = Math.floor(frameIndex / columns) * frameHeight
      const data = ctx.getImageData(startX, startY, frameWidth, frameHeight).data
      let pixels = 0

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245 && data[i + 3] > 245) {
          pixels += 1
        }
      }

      return pixels
    }

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      frames: [0, 11].map(frameIndex => ({
        base: colorStats(frameIndex, [185, 122, 87]),
        object: colorStats(frameIndex, [136, 0, 21]),
        whitePixels: whitePixels(frameIndex),
      })),
    }
  }, png.toString('base64'))
}

test('exports PNG spritesheet and JSON metadata with transparent PNG sample pixels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles([
    path.join(process.cwd(), 'samples/base.png'),
    path.join(process.cwd(), 'samples/object.png'),
  ])
  await expect(page.locator('.part span')).toHaveText(['object.png', 'base.png'])

  const downloads: import('@playwright/test').Download[] = []
  page.on('download', download => downloads.push(download))
  await page.getByRole('button', { name: 'Export PNG SpriteSheet + JSON' }).click()
  await expect.poll(() => downloads.map(download => download.suggestedFilename()).sort()).toEqual(['spritesheet.json', 'spritesheet.png'])

  const pngDownload = downloads.find(download => download.suggestedFilename() === 'spritesheet.png')
  const jsonDownload = downloads.find(download => download.suggestedFilename() === 'spritesheet.json')
  expect(pngDownload, 'spritesheet.png download').toBeTruthy()
  expect(jsonDownload, 'spritesheet.json download').toBeTruthy()
  if (!pngDownload || !jsonDownload) return

  const jsonPath = await jsonDownload.path()
  const pngPath = await pngDownload.path()
  expect(jsonPath).toBeTruthy()
  expect(pngPath).toBeTruthy()
  if (!jsonPath || !pngPath) return

  const meta = JSON.parse(await fs.readFile(jsonPath, 'utf8'))
  expect(meta).toEqual({
    image: 'spritesheet.png',
    frameWidth: 512,
    frameHeight: 512,
    fps: 12,
    frames: 12,
    columns: 6,
  })

  const stats = await readSpriteSheetStats(page, pngPath)
  expect(stats.width).toBe(512 * 6)
  expect(stats.height).toBe(512 * 2)

  for (const frame of stats.frames) {
    expect(frame.base.pixels).toBeGreaterThan(9000)
    expect(frame.object.pixels).toBeGreaterThan(1500)
    expect(frame.base.bbox?.minX).toBeGreaterThan(150)
    expect(frame.base.bbox?.minY).toBeGreaterThan(150)
    expect(frame.base.bbox?.maxX).toBeLessThan(356)
    expect(frame.base.bbox?.maxY).toBeLessThan(356)
    expect(frame.object.bbox?.minX).toBeGreaterThan(150)
    expect(frame.object.bbox?.minY).toBeGreaterThan(150)
    expect(frame.object.bbox?.maxX).toBeLessThan(356)
    expect(frame.object.bbox?.maxY).toBeLessThan(356)
    expect(frame.whitePixels).toBe(0)
  }
})
