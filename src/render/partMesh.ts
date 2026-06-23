import { Container, Graphics, MeshSimple, Texture } from 'pixi.js'
import { hitTestVertex } from '../mesh/hitTestVertex'
import { evaluatePartVertices } from './evaluateDeformation'
import type { Part, Vec2 } from '../editor/types'

export type RuntimePart = { partId: string; container: Container; mesh: MeshSimple; handles: Graphics; vertices: Vec2[] }
export const flat = (v: Vec2[]) => new Float32Array(v.flatMap(p => [p.x, p.y]))
export const uvFlat = (v: Vec2[]) => new Float32Array(v.flatMap(p => [p.x, p.y]))

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  if (image.decode) {
    await image.decode()
  } else {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    })
  }
  return image
}

export async function createRuntimePart(part: Part): Promise<RuntimePart> {
  const texture = Texture.from(await loadImage(part.imageUrl), true)
  const container = new Container()
  const mesh = new MeshSimple({ texture, vertices: flat(part.mesh.vertices), uvs: uvFlat(part.mesh.uvs), indices: new Uint32Array(part.mesh.indices), topology: 'triangle-list' })
  const handles = new Graphics()
  container.addChild(mesh, handles)
  return { partId: part.id, container, mesh, handles, vertices: part.mesh.vertices.map(v => ({ ...v })) }
}

type HandleMode = 'none' | 'deform' | 'mesh'

export function syncRuntimePart(rt: RuntimePart, part: Part, parameterValues: Record<string, number>, handleMode: HandleMode, verticesOverride?: Vec2[], dimmed = false, selectedVertexIndex?: number) {
  rt.container.position.set(part.transform.x, part.transform.y)
  rt.container.rotation = part.transform.rotation
  rt.container.scale.set(part.transform.scaleX, part.transform.scaleY)
  rt.container.alpha = part.transform.opacity * (dimmed ? 0.45 : 1)
  rt.container.visible = part.visible
  rt.container.zIndex = part.zIndex
  rt.vertices = verticesOverride?.map(v => ({ ...v })) ?? evaluatePartVertices(part, parameterValues)
  rt.mesh.vertices = flat(rt.vertices)
  rt.mesh.geometry.uvs = uvFlat(part.mesh.uvs)
  rt.mesh.geometry.indices = new Uint32Array(part.mesh.indices)
  rt.handles.clear()
  if (handleMode !== 'none' && part.visible) {
    const lineColor = handleMode === 'mesh' ? 0xffd36e : 0x20e0ff
    const handleColor = handleMode === 'mesh' ? 0xff8f33 : 0xffe066
    for (let i = 0; i < part.mesh.indices.length; i += 3) {
      const a = rt.vertices[part.mesh.indices[i]], b = rt.vertices[part.mesh.indices[i + 1]], c = rt.vertices[part.mesh.indices[i + 2]]
      rt.handles.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(a.x, a.y).stroke({ width: 1, color: lineColor, alpha: 0.9 })
    }
    rt.vertices.forEach((v, i) => rt.handles.circle(v.x, v.y, i === selectedVertexIndex ? 7 : 5).fill({ color: i === selectedVertexIndex ? 0xffffff : handleColor }).stroke({ width: 1, color: 0x222222 }))
  }
}

export function findHitVertex(rt: RuntimePart, global: Vec2): number | null {
  const local = rt.container.toLocal(global)
  return hitTestVertex(rt.vertices, { x: local.x, y: local.y })
}
