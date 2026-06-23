import { evaluateAnimation } from '../animation/evaluateAnimation'
import type { Project } from '../editor/types'
import { createPixiApp } from './pixiApp'
import { createRuntimePart, syncRuntimePart } from './partMesh'

function downloadBlob(blob: Blob, filename: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }

type SpriteSheetExportOptions = {
  frameWidth?: number
  frameHeight?: number
  columns?: number
  frames?: number
}

type ZipEntry = {
  filename: string
  data: Uint8Array
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
  return offset + 2
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
  return offset + 4
}

function createZip(entries: ZipEntry[]) {
  const encoder = new TextEncoder()
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const filename = encoder.encode(entry.filename)
    const crc = crc32(entry.data)
    const local = new Uint8Array(30 + filename.length + entry.data.length)
    const localView = new DataView(local.buffer)
    let p = 0
    p = writeUint32(localView, p, 0x04034b50)
    p = writeUint16(localView, p, 20)
    p = writeUint16(localView, p, 0)
    p = writeUint16(localView, p, 0)
    p = writeUint16(localView, p, 0)
    p = writeUint16(localView, p, 0)
    p = writeUint32(localView, p, crc)
    p = writeUint32(localView, p, entry.data.length)
    p = writeUint32(localView, p, entry.data.length)
    p = writeUint16(localView, p, filename.length)
    p = writeUint16(localView, p, 0)
    local.set(filename, p)
    local.set(entry.data, p + filename.length)
    localChunks.push(local)

    const central = new Uint8Array(46 + filename.length)
    const centralView = new DataView(central.buffer)
    p = 0
    p = writeUint32(centralView, p, 0x02014b50)
    p = writeUint16(centralView, p, 20)
    p = writeUint16(centralView, p, 20)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint32(centralView, p, crc)
    p = writeUint32(centralView, p, entry.data.length)
    p = writeUint32(centralView, p, entry.data.length)
    p = writeUint16(centralView, p, filename.length)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint16(centralView, p, 0)
    p = writeUint32(centralView, p, 0)
    p = writeUint32(centralView, p, offset)
    central.set(filename, p)
    centralChunks.push(central)

    offset += local.length
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  let p = 0
  p = writeUint32(endView, p, 0x06054b50)
  p = writeUint16(endView, p, 0)
  p = writeUint16(endView, p, 0)
  p = writeUint16(endView, p, entries.length)
  p = writeUint16(endView, p, entries.length)
  p = writeUint32(endView, p, centralSize)
  p = writeUint32(endView, p, offset)
  writeUint16(endView, p, 0)

  const chunks = [...localChunks, ...centralChunks, end]
  const zip = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let writeOffset = 0
  for (const chunk of chunks) {
    zip.set(chunk, writeOffset)
    writeOffset += chunk.length
  }

  return new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' })
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed to create spritesheet PNG')), 'image/png')
  })
}

export async function exportSpriteSheet(project: Project, options: SpriteSheetExportOptions = {}) {
  const frameWidth = options.frameWidth ?? 512
  const frameHeight = options.frameHeight ?? 512
  const columns = options.columns ?? 6
  const frames = Math.max(1, Math.floor(options.frames ?? Math.ceil(project.animation.fps * project.animation.duration)))
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
  const meta = { image: 'spritesheet.png', frameWidth, frameHeight, fps: project.animation.fps, frames, columns }
  const pngBlob = await canvasToPngBlob(sheet)
  const zip = createZip([
    { filename: 'spritesheet.png', data: new Uint8Array(await pngBlob.arrayBuffer()) },
    { filename: 'spritesheet.json', data: new TextEncoder().encode(JSON.stringify(meta, null, 2)) },
  ])
  downloadBlob(zip, 'spritesheet.zip')
}
