import { useEffect, useRef } from 'react'
import { useEditorStore } from '../editor/store'
import type { Vec2 } from '../editor/types'
import { createPixiApp } from './pixiApp'
import { createRuntimePart, findHitVertex, syncRuntimePart, type RuntimePart } from './partMesh'

export function PixiViewport() {
  const host = useRef<HTMLDivElement>(null)
  const runtimes = useRef(new Map<string, RuntimePart>())
  const appRef = useRef<Awaited<ReturnType<typeof createPixiApp>> | null>(null)
  const drag = useRef<{ partId: string; vertexIndex: number } | null>(null)
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
      const s = useEditorStore.getState(), p = s.parts.find(x => x.id === s.selectedPartId); if (!p) return
      const rt = runtimes.current.get(p.id); if (!rt) return
      const hit = findHitVertex(rt, { x: e.offsetX, y: e.offsetY })
      if (hit != null) { drag.current = { partId: p.id, vertexIndex: hit }; app.canvas.setPointerCapture(e.pointerId) }
    }
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return
      const rt = runtimes.current.get(d.partId); if (!rt) return
      const local = rt.container.toLocal({ x: e.offsetX, y: e.offsetY } as Vec2)
      rt.vertices[d.vertexIndex] = { x: local.x, y: local.y }
      rt.mesh.vertices = new Float32Array(rt.vertices.flatMap(v => [v.x, v.y]))
      rt.handles.clear()
      rt.vertices.forEach(v => rt.handles.circle(v.x, v.y, 5).fill({ color: 0xff8f33 }).stroke({ width: 1, color: 0x222222 }))
    }
    const up = () => { const d = drag.current; if (d) { const rt = runtimes.current.get(d.partId); if (rt) useEditorStore.getState().updatePartVertices(d.partId, rt.vertices) } drag.current = null }
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
      store.parts.forEach(part => { const rt = runtimes.current.get(part.id); if (rt && !drag.current) syncRuntimePart(rt, part, store.parameterValues, part.id === store.selectedPartId, store.editVertices[part.id]) })
    }
    run(); return () => { cancelled = true }
  }, [store.parts, store.parameterValues, store.selectedPartId, store.editVertices])

  return <div className="viewport" ref={host} />
}
