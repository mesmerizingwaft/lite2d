import { useEffect, useRef } from 'react'
import { useEditorStore } from '../editor/store'
import type { Vec2 } from '../editor/types'
import { rebuildMeshFromVertices } from '../mesh/rebuildMesh'
import { createPixiApp } from './pixiApp'
import { createRuntimePart, findHitVertex, syncRuntimePart, type RuntimePart } from './partMesh'

export function PixiViewport() {
  const host = useRef<HTMLDivElement>(null)
  const runtimes = useRef(new Map<string, RuntimePart>())
  const appRef = useRef<Awaited<ReturnType<typeof createPixiApp>> | null>(null)
  const drag = useRef<{ mode: 'mesh' | 'deform'; partId: string; vertexIndex: number; selectedVertexIndices: number[]; startLocal: Vec2; startVertices: Vec2[] } | null>(null)
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
      const s = useEditorStore.getState()
      if (s.isPlaying) return

      const meshPart = s.parts.find(x => x.id === s.editingPartId)
      if (meshPart) {
        const rt = runtimes.current.get(meshPart.id); if (!rt) return
        const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
        const hit = findHitVertex(rt, { x: e.offsetX, y: e.offsetY })
        if (hit != null) {
          const currentSelection = s.selectedMeshVertexIndices.includes(hit) ? s.selectedMeshVertexIndices : [hit]
          const selectedVertexIndices = e.ctrlKey ? toggleVertexSelection(s.selectedMeshVertexIndices, hit) : currentSelection
          useEditorStore.getState().selectMeshVertices(selectedVertexIndices)
          drag.current = { mode: 'mesh', partId: meshPart.id, vertexIndex: hit, selectedVertexIndices, startLocal: local, startVertices: meshPart.mesh.vertices.map(v => ({ ...v })) }
          app.canvas.setPointerCapture(e.pointerId)
          return
        }
        const next = rebuildMeshFromVertices(meshPart.width, meshPart.height, [...meshPart.mesh.vertices, local])
        const vertexIndex = next.vertices.length - 1
        applyRuntimeMesh(rt, next.vertices, next.uvs, next.indices, [vertexIndex])
        useEditorStore.getState().updatePartMesh(meshPart.id, next, [vertexIndex])
        drag.current = { mode: 'mesh', partId: meshPart.id, vertexIndex, selectedVertexIndices: [vertexIndex], startLocal: local, startVertices: next.vertices.map(v => ({ ...v })) }
        app.canvas.setPointerCapture(e.pointerId)
        return
      }

      const deformPart = s.parts.find(x => x.id === s.selectedPartId); if (!deformPart) return
      const rt = runtimes.current.get(deformPart.id); if (!rt) return
      const hit = findHitVertex(rt, { x: e.offsetX, y: e.offsetY })
      if (hit != null) { drag.current = { mode: 'deform', partId: deformPart.id, vertexIndex: hit, selectedVertexIndices: [hit], startLocal: rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2), startVertices: rt.vertices.map(v => ({ ...v })) }; app.canvas.setPointerCapture(e.pointerId) }
    }
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return
      const rt = runtimes.current.get(d.partId); if (!rt) return
      const part = useEditorStore.getState().parts.find(p => p.id === d.partId); if (!part) return
      const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
      if (d.mode === 'mesh') {
        const dx = local.x - d.startLocal.x
        const dy = local.y - d.startLocal.y
        const selected = new Set(d.selectedVertexIndices)
        const vertices = d.startVertices.map((v, i) => selected.has(i) ? { x: v.x + dx, y: v.y + dy } : v)
        const next = rebuildMeshFromVertices(part.width, part.height, vertices)
        applyRuntimeMesh(rt, next.vertices, next.uvs, next.indices, d.selectedVertexIndices)
      } else {
        rt.vertices[d.vertexIndex] = { x: local.x, y: local.y }
        rt.mesh.vertices = new Float32Array(rt.vertices.flatMap(v => [v.x, v.y]))
        rt.handles.clear()
        rt.vertices.forEach(v => rt.handles.circle(v.x, v.y, 5).fill({ color: 0xff8f33 }).stroke({ width: 1, color: 0x222222 }))
      }
    }
    const up = () => {
      const d = drag.current
      if (d) {
        const rt = runtimes.current.get(d.partId)
        const part = useEditorStore.getState().parts.find(p => p.id === d.partId)
        if (rt && part) {
          if (d.mode === 'mesh') useEditorStore.getState().updatePartMesh(d.partId, rebuildMeshFromVertices(part.width, part.height, rt.vertices), d.selectedVertexIndices)
          else useEditorStore.getState().updatePartVertices(d.partId, rt.vertices)
        }
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
      for (const [id, rt] of runtimes.current) if (!store.parts.some(p => p.id === id)) { rt.container.destroy({ children: true }); runtimes.current.delete(id) }
      store.parts.forEach(part => {
        const rt = runtimes.current.get(part.id)
        const meshEditing = part.id === store.editingPartId
        const deformEditing = !store.editingPartId && !store.isPlaying && part.id === store.selectedPartId
        const handleMode = meshEditing ? 'mesh' : deformEditing ? 'deform' : 'none'
        const vertices = meshEditing ? part.mesh.vertices : store.editVertices[part.id]
        if (rt && !drag.current) syncRuntimePart(rt, part, store.parameterValues, handleMode, vertices, Boolean(store.editingPartId && !meshEditing), meshEditing ? store.selectedMeshVertexIndices : undefined)
      })
    }
    run(); return () => { cancelled = true }
  }, [store.parts, store.parameterValues, store.selectedPartId, store.editingPartId, store.selectedMeshVertexIndices, store.editVertices, store.isPlaying])

  return <div className="viewport" ref={host} />
}

function applyRuntimeMesh(rt: RuntimePart, vertices: Vec2[], uvs: Vec2[], indices: number[], selectedVertexIndices: number[] = []) {
  rt.vertices = vertices.map(v => ({ ...v }))
  rt.mesh.vertices = new Float32Array(rt.vertices.flatMap(v => [v.x, v.y]))
  rt.mesh.geometry.uvs = new Float32Array(uvs.flatMap(v => [v.x, v.y]))
  rt.mesh.geometry.indices = new Uint32Array(indices)
  rt.handles.clear()
  for (let i = 0; i < indices.length; i += 3) {
    const a = rt.vertices[indices[i]], b = rt.vertices[indices[i + 1]], c = rt.vertices[indices[i + 2]]
    rt.handles.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).lineTo(a.x, a.y).stroke({ width: 1, color: 0xffd36e, alpha: 0.9 })
  }
  const selected = new Set(selectedVertexIndices)
  rt.vertices.forEach((v, i) => rt.handles.circle(v.x, v.y, selected.has(i) ? 7 : 5).fill({ color: selected.has(i) ? 0xffffff : 0xff8f33 }).stroke({ width: 1, color: 0x222222 }))
}

function toggleVertexSelection(selection: number[], vertexIndex: number) {
  return selection.includes(vertexIndex) ? selection.filter(index => index !== vertexIndex) : [...selection, vertexIndex]
}
