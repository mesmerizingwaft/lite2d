import { useEffect, useRef } from 'react'
import { useEditorStore } from '../editor/store'
import type { Vec2 } from '../editor/types'
import { rebuildMeshFromVertices } from '../mesh/rebuildMesh'
import { createPixiApp } from './pixiApp'
import { createRuntimePart, findHitVertex, syncRuntimePart, type RuntimePart } from './partMesh'

type Bounds = { left: number; top: number; right: number; bottom: number }
type Drag =
  | { mode: 'mesh'; partId: string; vertexIndex: number }
  | { mode: 'deform'; partId: string; selectedVertexIndices: number[]; startLocal: Vec2; startVertices: Vec2[] }
  | { mode: 'select'; partId: string; startLocal: Vec2 }

export function PixiViewport() {
  const host = useRef<HTMLDivElement>(null)
  const runtimes = useRef(new Map<string, RuntimePart>())
  const appRef = useRef<Awaited<ReturnType<typeof createPixiApp>> | null>(null)
  const drag = useRef<Drag | null>(null)
  const store = useEditorStore()

  useEffect(() => {
    let dead = false, app: Awaited<ReturnType<typeof createPixiApp>>
    createPixiApp().then(a => {
      if (dead) { a.destroy(); return }
      app = a; appRef.current = a; host.current?.appendChild(app.canvas)
      app.canvas.addEventListener('pointerdown', down)
      app.canvas.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      app.ticker.add(tick)
    })
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      const s = useEditorStore.getState()
      if (s.isPlaying) return

      const meshPart = s.parts.find(x => x.id === s.editingPartId)
      if (meshPart) {
        const rt = runtimes.current.get(meshPart.id); if (!rt) return
        const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
        const hit = findHitVertex(rt, { x: e.offsetX, y: e.offsetY })
        if (hit != null) {
          useEditorStore.getState().selectMeshVertex(hit)
          drag.current = { mode: 'mesh', partId: meshPart.id, vertexIndex: hit }
          app.canvas.setPointerCapture(e.pointerId)
          return
        }
        const next = rebuildMeshFromVertices(meshPart.width, meshPart.height, [...meshPart.mesh.vertices, local])
        const vertexIndex = next.vertices.length - 1
        applyRuntimeMesh(rt, next.vertices, next.uvs, next.indices, vertexIndex)
        useEditorStore.getState().updatePartMesh(meshPart.id, next, vertexIndex)
        drag.current = { mode: 'mesh', partId: meshPart.id, vertexIndex }
        app.canvas.setPointerCapture(e.pointerId)
        return
      }

      const deformPart = s.parts.find(x => x.id === s.selectedPartId); if (!deformPart) return
      const rt = runtimes.current.get(deformPart.id); if (!rt) return
      const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
      const hit = findHitVertex(rt, { x: e.offsetX, y: e.offsetY })
      if (hit != null) {
        const selectedVertexIndices = s.selectedDeformVertexIndices.includes(hit) ? s.selectedDeformVertexIndices : [hit]
        drag.current = { mode: 'deform', partId: deformPart.id, selectedVertexIndices, startLocal: local, startVertices: rt.vertices.map(vertex => ({ ...vertex })) }
        useEditorStore.getState().selectDeformVertices(selectedVertexIndices)
        drawDeformHandles(rt, deformPart.mesh.indices, selectedVertexIndices)
      } else {
        drag.current = { mode: 'select', partId: deformPart.id, startLocal: local }
        useEditorStore.getState().selectDeformVertices([])
        drawDeformHandles(rt, deformPart.mesh.indices, [])
      }
      app.canvas.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return
      const rt = runtimes.current.get(d.partId); if (!rt) return
      const part = useEditorStore.getState().parts.find(p => p.id === d.partId); if (!part) return
      const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
      if (d.mode === 'mesh') {
        const vertices = part.mesh.vertices.map((vertex, index) => index === d.vertexIndex ? local : vertex)
        const next = rebuildMeshFromVertices(part.width, part.height, vertices)
        applyRuntimeMesh(rt, next.vertices, next.uvs, next.indices, d.vertexIndex)
      } else if (d.mode === 'deform') {
        const dx = local.x - d.startLocal.x
        const dy = local.y - d.startLocal.y
        const selected = new Set(d.selectedVertexIndices)
        rt.vertices = d.startVertices.map((vertex, index) => selected.has(index) ? { x: vertex.x + dx, y: vertex.y + dy } : { ...vertex })
        rt.mesh.vertices = new Float32Array(rt.vertices.flatMap(vertex => [vertex.x, vertex.y]))
        drawDeformHandles(rt, part.mesh.indices, d.selectedVertexIndices)
      } else {
        const bounds = selectionBounds(d.startLocal, local)
        const selectedVertexIndices = rt.vertices.flatMap((vertex, index) => pointInBounds(vertex, bounds) ? [index] : [])
        useEditorStore.getState().selectDeformVertices(selectedVertexIndices)
        drawDeformHandles(rt, part.mesh.indices, selectedVertexIndices)
        drawSelectionBox(rt, bounds)
      }
    }
    const up = () => {
      const d = drag.current
      if (d) {
        const rt = runtimes.current.get(d.partId)
        const part = useEditorStore.getState().parts.find(p => p.id === d.partId)
        if (rt && part) {
          if (d.mode === 'mesh') useEditorStore.getState().updatePartMesh(d.partId, rebuildMeshFromVertices(part.width, part.height, rt.vertices), d.vertexIndex)
          else if (d.mode === 'deform') useEditorStore.getState().updatePartVertices(d.partId, rt.vertices)
        }
        rt?.selectionBox.clear()
      }
      drag.current = null
    }
    const tick = () => {
      const s = useEditorStore.getState()
      if (s.isPlaying) s.setTime((s.currentTime + app.ticker.deltaMS / 1000) % s.animation.duration)
    }
    return () => { dead = true; window.removeEventListener('pointerup', up); appRef.current = null; app?.destroy(true, { children: true }) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const app = appRef.current
      if (!app) return
      for (const part of store.parts) if (!runtimes.current.has(part.id)) {
        const rt = await createRuntimePart(part); if (cancelled) return
        runtimes.current.set(part.id, rt); app.stage.addChild(rt.container)
      }
      for (const [id, rt] of runtimes.current) if (!store.parts.some(part => part.id === id)) { rt.container.destroy({ children: true }); runtimes.current.delete(id) }
      store.parts.forEach(part => {
        const rt = runtimes.current.get(part.id)
        const meshEditing = part.id === store.editingPartId
        const deformEditing = !store.editingPartId && !store.isPlaying && part.id === store.selectedPartId
        const handleMode = meshEditing ? 'mesh' : deformEditing ? 'deform' : 'none'
        const vertices = meshEditing ? part.mesh.vertices : store.editVertices[part.id]
        const selectedVertexIndices = meshEditing
          ? store.selectedMeshVertexIndex == null ? [] : [store.selectedMeshVertexIndex]
          : deformEditing ? store.selectedDeformVertexIndices : []
        if (rt && !drag.current) syncRuntimePart(rt, part, store.parameterValues, handleMode, vertices, Boolean(store.editingPartId && !meshEditing), selectedVertexIndices)
      })
    }
    run(); return () => { cancelled = true }
  }, [store.parts, store.parameterValues, store.selectedPartId, store.editingPartId, store.selectedMeshVertexIndex, store.selectedDeformVertexIndices, store.editVertices, store.isPlaying])

  return <div className="viewport" ref={host} />
}

function applyRuntimeMesh(rt: RuntimePart, vertices: Vec2[], uvs: Vec2[], indices: number[], selectedVertexIndex?: number) {
  rt.vertices = vertices.map(vertex => ({ ...vertex }))
  rt.mesh.vertices = new Float32Array(rt.vertices.flatMap(vertex => [vertex.x, vertex.y]))
  rt.mesh.geometry.uvs = new Float32Array(uvs.flatMap(vertex => [vertex.x, vertex.y]))
  rt.mesh.geometry.indices = new Uint32Array(indices)
  rt.handles.clear()
  for (let i = 0; i < indices.length; i += 3) {
    const a = rt.vertices[indices[i]], b = rt.vertices[indices[i + 1]], c = rt.vertices[indices[i + 2]]
    rt.handles.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(a.x, a.y).stroke({ width: 1, color: 0xffd36e, alpha: 0.9 })
  }
  rt.vertices.forEach((vertex, index) => rt.handles.circle(vertex.x, vertex.y, index === selectedVertexIndex ? 7 : 5).fill({ color: index === selectedVertexIndex ? 0xffffff : 0xff8f33 }).stroke({ width: 1, color: 0x222222 }))
}

function drawDeformHandles(rt: RuntimePart, indices: number[], selectedVertexIndices: number[]) {
  rt.handles.clear()
  for (let i = 0; i < indices.length; i += 3) {
    const a = rt.vertices[indices[i]], b = rt.vertices[indices[i + 1]], c = rt.vertices[indices[i + 2]]
    rt.handles.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(a.x, a.y).stroke({ width: 1, color: 0x20e0ff, alpha: 0.9 })
  }
  const selected = new Set(selectedVertexIndices)
  rt.vertices.forEach((vertex, index) => rt.handles.circle(vertex.x, vertex.y, selected.has(index) ? 7 : 5).fill({ color: selected.has(index) ? 0xffffff : 0xffe066 }).stroke({ width: 1, color: 0x222222 }))
}

function selectionBounds(start: Vec2, end: Vec2): Bounds {
  return { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y) }
}

function pointInBounds(point: Vec2, bounds: Bounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom
}

function drawSelectionBox(rt: RuntimePart, bounds: Bounds) {
  rt.selectionBox.clear().rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top).fill({ color: 0x4bb7ff, alpha: 0.12 }).stroke({ width: 1, color: 0x4bb7ff, alpha: 0.9 })
}
