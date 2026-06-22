import { PARAM_DEFORM_ID, type Part, type Vec2 } from '../editor/types'
const clone = (v: Vec2[]) => v.map(p => ({ ...p }))
export function evaluatePartVertices(part: Part, parameterValues: Record<string, number>): Vec2[] {
  const value = parameterValues[PARAM_DEFORM_ID] ?? 0
  const k0 = part.keyforms.find(k => k.parameterId === PARAM_DEFORM_ID && k.value === 0)
  const k1 = part.keyforms.find(k => k.parameterId === PARAM_DEFORM_ID && k.value === 1)
  if (!k0 && !k1) return clone(part.mesh.vertices)
  if (!k0) return clone(k1!.vertices)
  if (!k1) return clone(k0.vertices)
  const t = Math.max(0, Math.min(1, value))
  return k0.vertices.map((a, i) => ({ x: a.x + ((k1.vertices[i]?.x ?? a.x) - a.x) * t, y: a.y + ((k1.vertices[i]?.y ?? a.y) - a.y) * t }))
}
