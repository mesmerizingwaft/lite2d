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

async function setDeformValue(page: import('@playwright/test').Page, value: '0' | '0.5' | '1') {
  const range = page.locator('input[type=range]')
  await range.fill(value)
  await expect(page.locator('output')).toHaveText(Number(value).toFixed(2))
}

async function dragCanvasVertex(page: import('@playwright/test').Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down()
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 })
  await page.mouse.up()
}

async function beginMeshEdit(page: import('@playwright/test').Page, name: string) {
  const row = page.locator('.part', { has: page.locator('span', { hasText: name }) })
  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('.edit-banner')).toContainText(`Editing mesh: ${name}`)
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

test('save value buttons commit the current edit pose for playback', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(path.join(process.cwd(), 'samples/base.png'))
  await expect(page.locator('.part span')).toHaveText(['base.png'])

  const initial = await pngColorStats(page, basePngColor)
  expect(initial.bbox).not.toBeNull()

  await dragCanvasVertex(page, { x: 289, y: 289 }, { x: 369, y: 249 })
  const editedValueOnePose = await pngColorStats(page, basePngColor)
  expect(editedValueOnePose.bbox?.maxX).toBeGreaterThan((initial.bbox?.maxX ?? 0) + 20)

  await page.getByRole('button', { name: 'Save value=1' }).click()
  await expect(page.locator('.status')).toHaveText('Saved value=1')

  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(async () => (await pngColorStats(page, basePngColor)).bbox?.maxX ?? 0).toBeGreaterThan((initial.bbox?.maxX ?? 0) + 20)
  await page.getByRole('button', { name: 'Stop' }).click()
  const stoppedAtZero = await pngColorStats(page, basePngColor)
  expect(stoppedAtZero.bbox?.maxX).toBeCloseTo(initial.bbox?.maxX ?? 0, 1)

  await dragCanvasVertex(page, { x: 222, y: 289 }, { x: 162, y: 249 })
  const editedValueZeroPose = await pngColorStats(page, basePngColor)
  expect(editedValueZeroPose.bbox?.minX).toBeLessThan((initial.bbox?.minX ?? 0) - 20)

  await page.getByRole('button', { name: 'Save value=0' }).click()
  await expect(page.locator('.status')).toHaveText('Saved value=0')
  await page.getByRole('button', { name: 'Stop' }).click()
  const savedZeroPose = await pngColorStats(page, basePngColor)
  expect(savedZeroPose.bbox?.minX).toBeLessThan((initial.bbox?.minX ?? 0) - 20)

  await setDeformValue(page, '1')
  const savedOnePose = await pngColorStats(page, basePngColor)
  expect(savedOnePose.bbox?.maxX).toBeCloseTo(editedValueOnePose.bbox?.maxX ?? 0, 1)
  expect(savedOnePose.bbox?.minX).toBeGreaterThan((editedValueZeroPose.bbox?.minX ?? 0) + 20)
})

test('mesh edit mode adds and deletes art mesh vertices', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(path.join(process.cwd(), 'samples/base.png'))
  await expect(page.locator('.part span')).toHaveText(['base.png'])
  await beginMeshEdit(page, 'base.png')

  const deleteButton = page.getByRole('button', { name: 'Delete Vertex' })
  await expect(deleteButton).toBeDisabled()

  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  await page.mouse.click(box.x + 256, box.y + 220)
  await expect(deleteButton).toBeEnabled()
  await deleteButton.click()
  await expect(deleteButton).toBeDisabled()
})
