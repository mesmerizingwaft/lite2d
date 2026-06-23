import type { MeshData } from '../editor/types'

export type MeshBounds = { left: number; top: number; right: number; bottom: number }

export function createGridMesh(width: number, height: number, gridX = 3, gridY = 3, bounds: MeshBounds = { left: 0, top: 0, right: width, bottom: height }): MeshData {
  const vertices = []
  const uvs = []
  const indices: number[] = []
  const left = Math.max(0, Math.min(width, bounds.left))
  const top = Math.max(0, Math.min(height, bounds.top))
  const right = Math.max(left, Math.min(width, bounds.right))
  const bottom = Math.max(top, Math.min(height, bounds.bottom))
  const meshWidth = right - left
  const meshHeight = bottom - top
  for (let y = 0; y <= gridY; y++) {
    for (let x = 0; x <= gridX; x++) {
      const u = x / gridX
      const v = y / gridY
      const px = left + u * meshWidth
      const py = top + v * meshHeight
      vertices.push({ x: px, y: py })
      uvs.push({ x: width ? px / width : 0, y: height ? py / height : 0 })
    }
  }
  for (let y = 0; y < gridY; y++) for (let x = 0; x < gridX; x++) {
    const a = y * (gridX + 1) + x, b = a + 1, c = a + gridX + 1, d = c + 1
    indices.push(a, b, c, b, d, c)
  }
  return { vertices, uvs, indices }
}
