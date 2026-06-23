import type { MeshData, Vec2 } from '../editor/types'

const EPSILON = 0.0001

type Triangle = { a: number; b: number; c: number }

function circumcircleContains(points: Vec2[], triangle: Triangle, point: Vec2) {
  const a = points[triangle.a]
  const b = points[triangle.b]
  const c = points[triangle.c]
  const ax = a.x - point.x
  const ay = a.y - point.y
  const bx = b.x - point.x
  const by = b.y - point.y
  const cx = c.x - point.x
  const cy = c.y - point.y
  const det = (ax * ax + ay * ay) * (bx * cy - cx * by)
    - (bx * bx + by * by) * (ax * cy - cx * ay)
    + (cx * cx + cy * cy) * (ax * by - bx * ay)
  return det > EPSILON
}

function triangleArea(points: Vec2[], triangle: Triangle) {
  const a = points[triangle.a]
  const b = points[triangle.b]
  const c = points[triangle.c]
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

export function triangulatePoints(points: Vec2[]): number[] {
  if (points.length < 3) return []
  const minX = Math.min(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxX = Math.max(...points.map(point => point.x))
  const maxY = Math.max(...points.map(point => point.y))
  const span = Math.max(maxX - minX, maxY - minY, 1)
  const superStart = points.length
  const work = [
    ...points,
    { x: minX - span * 8, y: minY - span },
    { x: minX + span / 2, y: maxY + span * 8 },
    { x: maxX + span * 8, y: minY - span },
  ]
  let triangles: Triangle[] = [{ a: superStart, b: superStart + 2, c: superStart + 1 }]

  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const bad = triangles.filter(triangle => circumcircleContains(work, triangle, work[pointIndex]))
    const polygon = new Map<string, [number, number]>()

    for (const triangle of bad) {
      const edges: [number, number][] = [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]
      for (const [a, b] of edges) {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`
        if (polygon.has(key)) polygon.delete(key)
        else polygon.set(key, [a, b])
      }
    }

    triangles = triangles.filter(triangle => !bad.includes(triangle))
    for (const [a, b] of polygon.values()) {
      const next = { a, b, c: pointIndex }
      triangles.push(triangleArea(work, next) < 0 ? { a: b, b: a, c: pointIndex } : next)
    }
  }

  return triangles
    .filter(triangle => triangle.a < points.length && triangle.b < points.length && triangle.c < points.length)
    .flatMap(triangle => [triangle.a, triangle.b, triangle.c])
}

export function rebuildMeshFromVertices(width: number, height: number, vertices: Vec2[]): MeshData {
  const clamped = vertices.map(vertex => ({
    x: Math.max(0, Math.min(width, vertex.x)),
    y: Math.max(0, Math.min(height, vertex.y)),
  }))
  const corners = [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: 0, y: height }, { x: width, y: height }]
  for (const corner of corners) {
    if (!clamped.some(vertex => Math.abs(vertex.x - corner.x) < 0.5 && Math.abs(vertex.y - corner.y) < 0.5)) {
      clamped.push(corner)
    }
  }
  return {
    vertices: clamped,
    uvs: clamped.map(vertex => ({ x: width ? vertex.x / width : 0, y: height ? vertex.y / height : 0 })),
    indices: triangulatePoints(clamped),
  }
}
