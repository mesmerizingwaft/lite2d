import { expect, test } from '@playwright/test'
import path from 'node:path'

const basePngColor: [number, number, number] = [185, 122, 87]

type ColorStats = {
  pixels: number
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
}

async function pngColorStats(page: import('@playwright/test').Page, color: [number, number, number]): Promise<ColorStats> {
  return page.locator('canvas').evaluate(async (canvas, targetColor) => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    const image = new Image()
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to copy canvas pixels'))
    })
    image.src = (canvas as HTMLCanvasElement).toDataURL()
    await imageLoaded

    const copy = document.createElement('canvas')
    copy.width = (canvas as HTMLCanvasElement).width
    copy.height = (canvas as HTMLCanvasElement).height
    const ctx = copy.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D canvas context')
    ctx.drawImage(image, 0, 0)

    const { width, height } = copy
    const data = ctx.getImageData(0, 0, width, height).data
    let pixels = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const colorDistance = Math.abs(data[i] - targetColor[0]) + Math.abs(data[i + 1] - targetColor[1]) + Math.abs(data[i + 2] - targetColor[2])
        if (colorDistance <= 24 && data[i + 3] > 180) {
          pixels += 1
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    return { pixels, bbox: pixels ? { minX, minY, maxX, maxY } : null }
  }, color)
}

test('keeps dragged mesh vertices visible after pointer release', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(path.join(process.cwd(), 'samples/base.png'))
  await expect(page.locator('.part span')).toHaveText(['base.png'])

  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  const before = await pngColorStats(page, basePngColor)
  await page.mouse.move(box.x + 289, box.y + 289)
  await page.mouse.down()
  await page.mouse.move(box.x + 369, box.y + 249, { steps: 8 })
  const during = await pngColorStats(page, basePngColor)
  await page.mouse.up()
  const after = await pngColorStats(page, basePngColor)

  expect(before.pixels).toBeGreaterThan(9000)
  expect(after.pixels).toBeGreaterThan(9000)
  expect(during.bbox?.maxX).toBeGreaterThan(before.bbox?.maxX ?? 0)
  expect(after.bbox?.maxX).toBeGreaterThan(before.bbox?.maxX ?? 0)
})
