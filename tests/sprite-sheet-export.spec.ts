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

function unzipStoredEntries(zip: Buffer) {
  const entries = new Map<string, Buffer>()
  let offset = 0

  while (offset + 4 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const compression = zip.readUInt16LE(offset + 8)
    const compressedSize = zip.readUInt32LE(offset + 18)
    const filenameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const filenameStart = offset + 30
    const dataStart = filenameStart + filenameLength + extraLength
    const filename = zip.subarray(filenameStart, filenameStart + filenameLength).toString('utf8')
    if (compression !== 0) throw new Error(`Unsupported ZIP compression method for ${filename}: ${compression}`)
    entries.set(filename, zip.subarray(dataStart, dataStart + compressedSize))
    offset = dataStart + compressedSize
  }

  return entries
}

async function readSpriteSheetStats(page: import('@playwright/test').Page, png: Buffer): Promise<SpriteSheetStats> {
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
      frames: [0, 7].map(frameIndex => ({
        base: colorStats(frameIndex, [185, 122, 87]),
        object: colorStats(frameIndex, [136, 0, 21]),
        whitePixels: whitePixels(frameIndex),
      })),
    }
  }, png.toString('base64'))
}

test('exports ZIP containing PNG spritesheet and JSON metadata with transparent PNG sample pixels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles([
    path.join(process.cwd(), 'samples/base.png'),
    path.join(process.cwd(), 'samples/object.png'),
  ])
  await expect(page.locator('.part span')).toHaveText(['object.png', 'base.png'])

  const downloads: import('@playwright/test').Download[] = []
  page.on('download', download => downloads.push(download))
  await page.getByLabel('Sprite sheet frame count').fill('8')
  await page.getByRole('button', { name: 'Export SpriteSheet ZIP' }).click()
  await expect.poll(() => downloads.map(download => download.suggestedFilename())).toEqual(['spritesheet.zip'])

  const zipPath = await downloads[0].path()
  expect(zipPath).toBeTruthy()
  if (!zipPath) return

  const entries = unzipStoredEntries(await fs.readFile(zipPath))
  const json = entries.get('spritesheet.json')
  const png = entries.get('spritesheet.png')
  expect(json, 'spritesheet.json in ZIP').toBeTruthy()
  expect(png, 'spritesheet.png in ZIP').toBeTruthy()
  if (!json || !png) return

  const meta = JSON.parse(json.toString('utf8'))
  expect(meta).toEqual({
    image: 'spritesheet.png',
    frameWidth: 512,
    frameHeight: 512,
    fps: 12,
    frames: 8,
    columns: 6,
  })

  const stats = await readSpriteSheetStats(page, png)
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
