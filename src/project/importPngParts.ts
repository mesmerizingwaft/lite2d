import { createGridMesh } from '../mesh/createGridMesh'
import { PARAM_DEFORM_ID, type Part } from '../editor/types'
export async function importPngParts(files: File[], startIndex: number): Promise<Part[]> {
  const pngs = files.filter(f => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png'))
  return Promise.all(pngs.map((file, i) => new Promise<Part>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const img = new Image(); img.onload = () => {
      const mesh = createGridMesh(img.naturalWidth, img.naturalHeight)
      resolve({ id: crypto.randomUUID(), name: file.name, imageUrl, width: img.naturalWidth, height: img.naturalHeight, visible: true, zIndex: startIndex + i, transform: { x: 256 - img.naturalWidth / 2, y: 256 - img.naturalHeight / 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, mesh, keyforms: [{ parameterId: PARAM_DEFORM_ID, value: 0, vertices: mesh.vertices.map(v => ({ ...v })) }] })
    }; img.onerror = reject; img.src = imageUrl
  })))
}
