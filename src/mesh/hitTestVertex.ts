import type { Vec2 } from '../editor/types'
export function hitTestVertex(vertices: Vec2[], point: Vec2, radius = 8): number | null {
  let best: number | null = null, bestD = radius * radius
  vertices.forEach((v, i) => { const dx = v.x - point.x, dy = v.y - point.y, d = dx * dx + dy * dy; if (d <= bestD) { bestD = d; best = i } })
  return best
}
