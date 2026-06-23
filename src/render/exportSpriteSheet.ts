import { evaluateAnimation } from '../animation/evaluateAnimation'
import type { Project } from '../editor/types'
import { createPixiApp } from './pixiApp'
import { createRuntimePart, syncRuntimePart } from './partMesh'

function downloadBlob(blob: Blob, filename: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }

export async function exportSpriteSheet(project: Project, frameWidth = 512, frameHeight = 512, columns = 6) {
  const frames = Math.ceil(project.animation.fps * project.animation.duration)
  const rows = Math.ceil(frames / columns)
  const sheet = document.createElement('canvas'); sheet.width = columns * frameWidth; sheet.height = rows * frameHeight
  const ctx = sheet.getContext('2d')!
  const app = await createPixiApp(frameWidth, frameHeight)
  const runtimes = await Promise.all(project.parts.map(createRuntimePart))
  runtimes.forEach(rt => app.stage.addChild(rt.container))
  for (let f = 0; f < frames; f++) {
    const values = { ...project.parameterValues, ...evaluateAnimation(project.animation, f / project.animation.fps) }
    project.parts.forEach(p => { const rt = runtimes.find(r => r.partId === p.id); if (rt) syncRuntimePart(rt, p, values, 'none') })
    app.renderer.render(app.stage)
    ctx.drawImage(app.canvas, (f % columns) * frameWidth, Math.floor(f / columns) * frameHeight)
  }
  app.destroy(true, { children: true })
  sheet.toBlob(blob => blob && downloadBlob(blob, 'spritesheet.png'), 'image/png')
  const meta = { image: 'spritesheet.png', frameWidth, frameHeight, fps: project.animation.fps, frames, columns }
  downloadBlob(new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' }), 'spritesheet.json')
}
