import { expect, test } from '@playwright/test'
import path from 'node:path'

type CanvasStats = {
  changed: number
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null
  colors: [string, number][]
}

const expected = {
  base: { visiblePixels: 11446, color: '185,122,87,255' },
  object: { visiblePixels: 1869, color: '136,0,21,255' },
}

async function togglePart(page: import('@playwright/test').Page, name: string) {
  const row = page.locator('.part', { has: page.locator('span', { hasText: name }) })
  await row.getByRole('button').first().click()
}

async function selectPart(page: import('@playwright/test').Page, name: string) {
  await page.locator('.part span', { hasText: name }).click()
}

async function canvasStats(page: import('@playwright/test').Page): Promise<CanvasStats> {
  return page.locator('canvas').evaluate(async canvas => {
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
    let changed = 0
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    const colors = new Map<string, number>()

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const diff = Math.abs(data[i] - 38) + Math.abs(data[i + 1] - 42) + Math.abs(data[i + 2] - 51)
        if (diff > 18) {
          changed += 1
          const key = `${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`
          colors.set(key, (colors.get(key) ?? 0) + 1)
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    return {
      changed,
      bbox: changed ? { minX, minY, maxX, maxY } : null,
      colors: [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    }
  })
}

test('renders transparent PNG samples with their actual pixels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles([
    path.join(process.cwd(), 'samples/base.png'),
    path.join(process.cwd(), 'samples/object.png'),
  ])

  await expect(page.locator('.part span')).toHaveText(['object.png', 'base.png'])

  await togglePart(page, 'object.png')
  let stats = await canvasStats(page)
  expect(stats.changed).toBe(expected.base.visiblePixels)
  expect(stats.colors[0][0]).toBe(expected.base.color)
  expect(stats.colors[0][1]).toBeGreaterThan(expected.base.visiblePixels * 0.9)
  expect(stats.colors.some(([color]) => color === '255,255,255,255')).toBe(false)

  await togglePart(page, 'object.png')
  await selectPart(page, 'base.png')
  await togglePart(page, 'base.png')
  stats = await canvasStats(page)
  expect(stats.changed).toBe(expected.object.visiblePixels)
  expect(stats.colors[0][0]).toBe(expected.object.color)
  expect(stats.colors[0][1]).toBeGreaterThan(expected.object.visiblePixels * 0.9)
  expect(stats.colors.some(([color]) => color === '255,255,255,255')).toBe(false)
})
