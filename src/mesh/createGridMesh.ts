import type { MeshData } from '../editor/types'

export function createGridMesh(width: number, height: number, gridX = 3, gridY = 3): MeshData {
  const vertices = []
  const uvs = []
  const indices: number[] = []
  for (let y = 0; y <= gridY; y++) {
    for (let x = 0; x <= gridX; x++) {
      const u = x / gridX
      const v = y / gridY
      vertices.push({ x: u * width, y: v * height })
      uvs.push({ x: u, y: v })
    }
  }
  for (let y = 0; y < gridY; y++) for (let x = 0; x < gridX; x++) {
    const a = y * (gridX + 1) + x, b = a + 1, c = a + gridX + 1, d = c + 1
    indices.push(a, b, c, b, d, c)
  }
  return { vertices, uvs, indices }
}
