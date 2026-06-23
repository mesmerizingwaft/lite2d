import { createGridMesh, type MeshBounds } from '../mesh/createGridMesh'
import { PARAM_DEFORM_ID, type Part } from '../editor/types'

const MESH_BOUNDS_PADDING = 2

function detectOpaqueBounds(img: HTMLImageElement): MeshBounds | null {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX < minX || maxY < minY) return null
  return {
    left: Math.max(0, minX - MESH_BOUNDS_PADDING),
    top: Math.max(0, minY - MESH_BOUNDS_PADDING),
    right: Math.min(width, maxX + 1 + MESH_BOUNDS_PADDING),
    bottom: Math.min(height, maxY + 1 + MESH_BOUNDS_PADDING),
  }
}

export async function importPngParts(files: File[], startIndex: number): Promise<Part[]> {
  const pngs = files.filter(f => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'))
  return Promise.all(pngs.map((file, i) => new Promise<Part>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const img = new Image(); img.onload = () => {
      const mesh = createGridMesh(img.naturalWidth, img.naturalHeight, 3, 3, detectOpaqueBounds(img) ?? undefined)
      resolve({ id: crypto.randomUUID(), name: file.name, imageUrl, width: img.naturalWidth, height: img.naturalHeight, visible: true, zIndex: startIndex + i, transform: { x: 256 - img.naturalWidth / 2, y: 256 - img.naturalHeight / 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, mesh, keyforms: [{ parameterId: PARAM_DEFORM_ID, value: 0, vertices: mesh.vertices.map(v => ({ ...v })) }] })
    }; img.onerror = reject; img.src = imageUrl
  })))
}
